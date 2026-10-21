/**
 * NetEase Cloud Music adapter.
 *
 * Everything runs on the Host behind the plugin's own `/music/*` routes: the
 * provider APIs answer no CORS headers, and cookies must never be readable by
 * page scripts anyway.
 *
 * Login supports the two ways a browser can actually complete:
 *   - phone / email + password (`/api/login`), when the account allows it;
 *   - a pasted `MUSIC_U` cookie, which is what an ordinary web sign-in leaves.
 * The QR code the web page shows cannot be rendered outside that page (its
 * `codekey` is bound to the page session), so it is deliberately not faked.
 */
import { cookieHeader, postForm, request } from '../http.js'

const BASE = 'https://music.163.com'
const REFERER = { Referer: 'https://music.163.com/', Origin: 'https://music.163.com' }
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function headers(session, extra = {}) {
  return {
    'User-Agent': UA,
    ...REFERER,
    ...(session && session.cookie ? { Cookie: cookieHeader(session.cookie) } : {}),
    ...extra,
  }
}

function json(response) {
  if (!response.json || typeof response.json !== 'object') {
    throw new Error(`网易云返回了非 JSON 响应（HTTP ${response.status}）`)
  }
  return response.json
}

/** Read the durable bits of `Set-Cookie` into a plain cookie map. */
function mergeCookies(session, response) {
  const next = { ...(session.cookie || {}) }
  for (const line of response.setCookie || []) {
    const pair = String(line).split(';')[0]
    const at = pair.indexOf('=')
    if (at <= 0) continue
    const name = pair.slice(0, at).trim()
    const value = pair.slice(at + 1).trim()
    if (!name) continue
    if (!value || /^deleted$/i.test(value)) delete next[name]
    else next[name] = value
  }
  return next
}

export const netease = {
  id: 'netease',
  name: '网易云音乐',

  async login(session, credentials) {
    const mode = credentials && credentials.mode
    if (mode === 'cookie') {
      const cookie = parseCookie(credentials.cookie)
      if (!cookie.MUSIC_U && !cookie.MUSIC_A) {
        throw new Error('Cookie 里没有 MUSIC_U，请确认复制的是已登录状态的完整 Cookie')
      }
      return { cookie }
    }
    if (mode !== 'password') throw new Error('不支持的登录方式')

    const account = String(credentials.account || '').trim()
    const password = String(credentials.password || '')
    if (!account || !password) throw new Error('请填写手机号/邮箱和密码')

    const body = new URLSearchParams({ username: account, password, rememberLogin: 'true' })
    const response = await postForm(`${BASE}/api/login`, body, { headers: headers(session) })
    const payload = json(response)
    if (payload.code !== 200) throw new Error(loginMessage(payload))
    const cookie = mergeCookies(session, response)
    for (const [name, value] of Object.entries(payload.cookie || {})) cookie[name] = value
    if (!cookie.MUSIC_U && !cookie.MUSIC_A) throw new Error('网易云没有返回登录 Cookie，请改用 Cookie 登录')
    return { cookie }
  },

  async check(session) {
    const payload = json(await request(`${BASE}/api/nuser/account/get`, { headers: headers(session) }))
    const profile = payload.profile
    if (!profile) return null
    return {
      uid: String(profile.userId || ''),
      name: String(profile.nickname || '网易云用户'),
      avatar: profile.avatarUrl ? String(profile.avatarUrl) : undefined,
    }
  },

  async playlists(session, account) {
    const uid = encodeURIComponent(account.uid)
    const payload = json(
      await request(`${BASE}/api/user/playlist?uid=${uid}&limit=1000&offset=0`, { headers: headers(session) }),
    )
    const list = Array.isArray(payload.playlist) ? payload.playlist : []
    return list.map((item) => ({
      id: String(item.id),
      name: String(item.name || '未命名歌单'),
      cover: item.coverImgUrl ? String(item.coverImgUrl) : undefined,
      count: Number(item.trackCount || 0),
      // `subscribed` is true for playlists the user collected but did not create.
      created: item.creator && String(item.creator.userId) === String(account.uid) && !item.subscribed,
      special: Number(item.specialType) === 5,
    }))
  },

  async tracks(session, playlistId) {
    // `n=1000` makes the playlist detail carry its tracks; the newer
    // track-all endpoint is not available on every deployment.
    const payload = json(
      await request(`${BASE}/api/v6/playlist/detail?id=${encodeURIComponent(playlistId)}&n=1000&s=0`, {
        headers: headers(session),
      }),
    )
    const tracks = (payload.playlist && payload.playlist.tracks) || []
    return tracks.map((track) => ({
      id: String(track.id),
      name: String(track.name || ''),
      artist: (track.ar || track.artists || []).map((a) => a.name).filter(Boolean).join(' / '),
      album: (track.al || track.album || {}).name || '',
      cover: coverOf(track),
      duration: Number(track.dt || track.duration || 0),
      // `fee`: 0 free, 1 VIP, 4 paid album, 8 copyright trial — everything but
      // 0 needs membership or a purchase to play in full.
      vip: Number(track.fee || 0) !== 0,
    }))
  },

  async lyric(session, track) {
    const payload = json(
      await request(`${BASE}/api/song/lyric?id=${encodeURIComponent(track.id)}&lv=1&kv=1&tv=-1`, {
        headers: headers(session),
      }),
    )
    return (payload.lrc && payload.lrc.lyric) || ''
  },

  async audio(session, track) {
    // Ask as the signed-in session: a free track (or one the account owns)
    // returns a URL, and an unavailable one returns a specific code.
    const payload = json(
      await request(
        `${BASE}/api/song/enhance/player/url?ids=%5B${encodeURIComponent(track.id)}%5D&br=320000`,
        { headers: headers(session) },
      ),
    )
    const entry = (payload.data && payload.data[0]) || {}
    if (entry.url) return { url: String(entry.url) }
    if (entry.freeTrialInfo) return { url: '', reason: '需要网易云会员（仅可试听）' }
    if (Number(entry.code) === -110) return { url: '', reason: '网易云没有该曲目的播放授权（可能需要会员或版权受限）' }
    return { url: '', reason: `网易云没有返回播放地址（code ${entry.code || '未知'}）` }
  },
}

function coverOf(track) {
  const album = track.al || track.album || {}
  if (album.picUrl) return String(album.picUrl)
  return undefined
}

function parseCookie(raw) {
  const cookie = {}
  for (const part of String(raw || '').split(';')) {
    const at = part.indexOf('=')
    if (at <= 0) continue
    cookie[part.slice(0, at).trim()] = part.slice(at + 1).trim()
  }
  return cookie
}

function loginMessage(payload) {
  const code = payload && payload.code
  if (code === 501) return '账号不存在'
  if (code === 502) return '密码错误'
  if (code === 503) return '登录过于频繁，请稍后再试'
  if (code === 400) return '请求参数不合法'
  return `网易云登录失败（code ${code}）${payload && payload.message ? `：${payload.message}` : ''}`
}
