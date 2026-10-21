/**
 * Provider registry and the plugin's service face.
 *
 * The browser half never talks to a music provider directly: every provider
 * answers without CORS headers, and the session cookies involved must stay out
 * of page-readable storage. It calls this service through the Host routes in
 * `routes.js`, which keeps one in-memory account (and its synced library) per
 * provider.
 */
import { netease } from './providers/netease.js'
import { qq } from './providers/qq.js'
import { loadAccounts, saveAccounts } from './store.js'

const ADAPTERS = { netease, qq }

export class MusicService {
  /** @param {{ log?: (message: string) => void }} [options] */
  constructor(options = {}) {
    this.adapters = ADAPTERS
    this.log = options.log || (() => {})
    /** @type {Map<string, { session: any, account: any, playlists: any[], syncedAt: number }>} */
    this.accounts = new Map()
    this.restore()
  }

  /**
   * Bring back the accounts stored by a previous run. Nothing is synced here:
   * the page asks for a sync when it opens, so a slow provider never delays the
   * Host's start-up.
   */
  restore() {
    const stored = loadAccounts()
    for (const [id, entry] of Object.entries(stored)) {
      if (!this.adapters[id] || !entry || typeof entry !== 'object') continue
      const cookie = entry.cookie && typeof entry.cookie === 'object' ? entry.cookie : null
      if (!cookie || Object.keys(cookie).length === 0) continue
      this.accounts.set(id, {
        session: { cookie },
        account: entry.account || null,
        playlists: [],
        syncedAt: 0,
      })
    }
  }

  persist() {
    const out = {}
    for (const [id, entry] of this.accounts) {
      out[id] = { cookie: entry.session.cookie, account: entry.account || null }
    }
    if (!saveAccounts(out)) this.log('could not persist the account store')
  }

  list() {
    return Object.values(this.adapters).map((item) => ({ id: item.id, name: item.name, mode: item.mode || 'account' }))
  }

  requireAdapter(id) {
    const adapter = this.adapters[id]
    if (!adapter) throw new Error(`未知的音乐平台：${id}`)
    return adapter
  }

  state(id) {
    const entry = this.accounts.get(id)
    if (!entry) return { id, signedIn: false, account: null, playlists: [], syncedAt: 0 }
    return {
      id,
      signedIn: true,
      account: entry.account,
      playlists: entry.playlists,
      syncedAt: entry.syncedAt,
      warning: entry.warning || '',
    }
  }

  states() {
    return Object.keys(this.adapters).map((id) => this.state(id))
  }

  async signIn(id, credentials) {
    const adapter = this.requireAdapter(id)
    if (typeof adapter.login !== 'function') throw new Error(`${adapter.name} 不支持账号登录`)
    const { cookie } = await adapter.login({ cookie: {} }, credentials || {})
    return this.complete(id, cookie)
  }

  /** Used by the QR flow, which already exchanged its own cookie. */
  async signInWithCookie(id, cookie) {
    const state = await this.complete(id, cookie)
    return state
  }

  async complete(id, cookie) {
    const adapter = this.requireAdapter(id)
    const session = { cookie }
    const account = await adapter.check(session)
    if (!account) throw new Error('登录没有生效：平台没有返回账号信息，Cookie 可能已失效')
    const entry = { session, account, playlists: [], syncedAt: 0 }
    this.accounts.set(id, entry)
    this.persist()
    const error = await this.syncQuietly(id)
    const state = this.state(id)
    if (error) state.syncError = error
    return state
  }

  async syncQuietly(id) {
    try {
      await this.sync(id)
      return ''
    } catch (error) {
      const message = error && error.message ? error.message : String(error)
      this.log(`sync ${id} failed: ${message}`)
      return message
    }
  }

  signOut(id) {
    this.accounts.delete(id)
    this.persist()
    return this.state(id)
  }

  /**
   * Rebuild a restored account's library the first time the page asks for it, so
   * a restarted Host shows playlists without a manual refresh.
   */
  async ensureSynced(id) {
    const entry = this.accounts.get(id)
    if (!entry || entry.syncedAt) return
    const account = await this.revalidate(id)
    if (!account) return
    await this.syncQuietly(id)
  }

  /**
   * Confirm a cookie restored from disk still belongs to a live session. A
   * failure never removes the account — only the explicit sign-out does — it
   * just keeps the saved library and records why the refresh stopped.
   */
  async revalidate(id) {
    const entry = this.accounts.get(id)
    if (!entry) return null
    try {
      const account = await this.adapters[id].check(entry.session)
      if (!account) {
        this.log(`revalidate ${id}: provider did not confirm the session; keeping the saved account`)
        return entry.account
      }
      entry.account = account
      return account
    } catch (error) {
      this.log(`revalidate ${id} failed: ${error && error.message ? error.message : String(error)}`)
      return entry.account
    }
  }

  async sync(id) {
    const adapter = this.requireAdapter(id)
    const entry = this.accounts.get(id)
    if (!entry) throw new Error('尚未登录')
    const playlists = await adapter.playlists(entry.session, entry.account)
    entry.playlists = playlists
    // Providers can attach a note to the list (e.g. "collected came back
    // empty"); surface it instead of silently showing a short library.
    entry.warning = playlists && playlists.warning ? String(playlists.warning) : ''
    if (entry.warning) this.log(`sync ${id}: ${entry.warning}`)
    entry.syncedAt = Date.now()
    return this.state(id)
  }

  async tracks(id, playlistId) {
    const adapter = this.requireAdapter(id)
    const entry = this.accounts.get(id)
    if (!entry) throw new Error('尚未登录')
    return adapter.tracks(entry.session, playlistId, entry.account)
  }

  async lyric(id, track) {
    const adapter = this.requireAdapter(id)
    const entry = this.accounts.get(id)
    // Lyrics are public on every provider, so a signed-out session still works.
    return adapter.lyric(entry ? entry.session : { cookie: {} }, track)
  }

  async audio(id, track) {
    const adapter = this.requireAdapter(id)
    const entry = this.accounts.get(id)
    return adapter.audio(entry ? entry.session : { cookie: {} }, track)
  }
}
