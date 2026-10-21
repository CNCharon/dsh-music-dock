window.__ModuleLoader__.load({
  id: 'dsh-music-player',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef, useCallback } = React

    /**
     * `useSyncExternalStore` is React 18+. The app ships a modern React, but a
     * fallback keeps the player alive on an older module table instead of
     * blanking the whole slot.
     */
    const useStore = React.useSyncExternalStore
      ? React.useSyncExternalStore
      : (subscribe, snapshot) => {
          const [value, setValue] = useState(snapshot)
          useEffect(() => {
            setValue(snapshot())
            return subscribe(() => setValue(snapshot()))
          }, [subscribe, snapshot])
          return value
        }

    /* ================================================================== *
     * i18n
     * ================================================================== */

    const NS = 'dsh-music-player'

    const ZH = {
      signIn: '登录',
      signOut: '退出登录',
      close: '关闭',
      cancel: '取消',
      loading: '加载中…',
      refresh: '刷新歌单',
      playlists: '歌单',
      created: '创建的歌单',
      collected: '收藏的歌单',
      favorites: '我喜欢的音乐',
      idle: '选一首歌开始播放',
      previous: '上一首',
      next: '下一首',
      play: '播放',
      pause: '暂停',
      volume: '音量',
      modeOrder: '顺序播放',
      modeShuffle: '随机播放',
      modeSingle: '单曲循环',
      modeHint: '播放模式：{mode}',
      noLyric: '暂无歌词',
      vipTrack: '会员 / 付费曲目',
      freeTrack: '普通曲目',
      hoverHint: '移出播放器显示歌词，移入显示控制',
      loadingSong: '正在获取播放地址…',
      notPlayable: '无法播放：{reason}',
      signInHint: '登录后自动拉取收藏与创建的全部歌单',
      account: '账号',
      qrTab: '扫码登录',
      cookieTab: 'Cookie 登录',
      qrWaiting: '打开 {app} 扫一扫',
      qrWaitingQq: '打开 QQ 或微信扫一扫',
      qrScanned: '已扫码，请在手机上确认',
      qrExpired: '二维码已过期',
      qrRefresh: '刷新二维码',
      qrFailed: '二维码获取失败：{reason}',
      cookieHint: '在浏览器里登录后，复制整段 Cookie 粘贴到这里',
      cookiePlaceholder: '例如 MUSIC_U=xxxx; ...',
      cookieSubmit: '登录',
      helpNetease: '在 music.163.com 登录后，从开发者工具 Network 里复制任意请求的 Cookie（需含 MUSIC_U）。',
      helpQq: '在 y.qq.com 登录后，从开发者工具 Network 里复制任意请求的 Cookie（需含 uin 与 qm_keyst）。',
      search: '搜索歌曲',
      searchPlaceholder: '搜索歌名或歌手',
      searchEmpty: '没有搜到结果',
      expand: '展开播放器',
      minimize: '收起到侧栏',
      collapse: '收起播放器',
      library: '歌单',
      now: '正在播放',
      settingsTitle: '音乐播放器',
      settingsIntro:
        '登录 QQ 音乐或网易云音乐后，插件会自动同步你收藏与创建的全部歌单。播放器嵌在左侧栏底部、其他插件按钮的上方：平时显示封面、歌名和当前歌词（底部一条播放进度），鼠标移入后歌词淡出、换成上一首、播放、下一首、播放模式和展开按钮；展开后在它上方打开完整面板，面板同样移出显示歌词、移入显示控制。',
      signedInAs: '已登录：{name}',
      songCount: '{count} 首',
      emptyPlaylist: '这个歌单还没有歌曲',
      loginFailed: '登录失败：{reason}',
      mode: '播放模式',
      lyricOffset: '歌词偏移',
      providers: '音乐平台',
      allPlaylists: '全部歌单',
      openLibrary: '打开歌单',
      back: '返回',
      playAll: '播放全部',
      selectProvider: '选择平台',
      htm: '网易云音乐',
      qq: 'QQ 音乐',
      loginTitle: '登录 {name}',
      signOutConfirm: '确定退出登录吗？',
      status: '状态',
      notSignedIn: '未登录',
      signed: '已登录',
      noPlaylists: '还没有歌单',
    }

    const EN = {
      signIn: 'Sign in',
      signOut: 'Sign out',
      close: 'Close',
      cancel: 'Cancel',
      loading: 'Loading…',
      refresh: 'Refresh playlists',
      playlists: 'Playlists',
      created: 'Created',
      collected: 'Collected',
      favorites: 'Liked songs',
      idle: 'Pick a song to start',
      previous: 'Previous',
      next: 'Next',
      play: 'Play',
      pause: 'Pause',
      volume: 'Volume',
      modeOrder: 'In order',
      modeShuffle: 'Shuffle',
      modeSingle: 'Repeat one',
      modeHint: 'Play mode: {mode}',
      noLyric: 'No lyrics',
      vipTrack: 'Member / paid track',
      freeTrack: 'Standard track',
      hoverHint: 'Move the pointer away for lyrics, back for controls',
      loadingSong: 'Resolving the audio URL…',
      notPlayable: 'Cannot play: {reason}',
      signInHint: 'Sign in to sync every playlist you created or collected',
      account: 'Account',
      qrTab: 'Scan QR',
      cookieTab: 'Cookie',
      qrWaiting: 'Scan with {app}',
      qrWaitingQq: 'Scan with QQ or WeChat',
      qrScanned: 'Scanned — confirm on your phone',
      qrExpired: 'The QR code expired',
      qrRefresh: 'Refresh QR code',
      qrFailed: 'Could not load the QR code: {reason}',
      cookieHint: 'Sign in in a browser, then paste the whole Cookie here',
      cookiePlaceholder: 'MUSIC_U=xxxx; ...',
      cookieSubmit: 'Sign in',
      helpNetease: 'Sign in at music.163.com, then copy a request Cookie from devtools → Network (it must contain MUSIC_U).',
      helpQq: 'Sign in at y.qq.com, then copy a request Cookie from devtools → Network (it must contain uin and qm_keyst).',
      search: 'Search',
      searchPlaceholder: 'Search a title or artist',
      searchEmpty: 'No results',
      expand: 'Expand the player',
      minimize: 'Minimize to the sidebar',
      collapse: 'Collapse the player',
      library: 'Playlists',
      now: 'Now playing',
      settingsTitle: 'Music player',
      settingsIntro:
        'Sign in to QQ Music or NetEase Cloud Music and the plugin syncs every playlist you created or collected. The player is embedded at the bottom of the sidebar, above the other plugins\u2019 buttons: with the pointer away it shows cover art, title, the current lyric line and a progress hairline; hovering fades the lyric into previous, play, next, play mode and expand. The expand button unfolds the full panel above it, which likewise shows lyrics while the pointer is away and controls while it is over.',
      signedInAs: 'Signed in as {name}',
      songCount: '{count} songs',
      emptyPlaylist: 'This playlist is empty',
      loginFailed: 'Sign-in failed: {reason}',
      mode: 'Play mode',
      lyricOffset: 'Lyric offset',
      providers: 'Providers',
      allPlaylists: 'All playlists',
      openLibrary: 'Open playlists',
      back: 'Back',
      playAll: 'Play all',
      selectProvider: 'Pick a provider',
      htm: 'NetEase',
      qq: 'QQ Music',
      loginTitle: 'Sign in to {name}',
      signOutConfirm: 'Sign out?',
      status: 'Status',
      notSignedIn: 'Not signed in',
      signed: 'Signed in',
      noPlaylists: 'No playlists yet',
    }

    let localeService = null
    let localeRevision = 0
    const localeListeners = new Set()
    /** The service-bound translator, once the locale service is attached. */
    let serviceTranslate = null

    function currentLocaleId() {
      if (!localeService) return 'zh'
      try {
        const snapshot = localeService.getSnapshot()
        return (snapshot && snapshot.active) || 'zh'
      } catch {
        return 'zh'
      }
    }

    function t(key, params) {
      if (serviceTranslate) {
        try {
          // `bind` returns the key itself when the namespace has no entry.
          const translated = serviceTranslate(key, params)
          if (translated && translated !== key) return translated
        } catch {
          /* fall through to the local dictionaries */
        }
      }
      const dict = /^en/i.test(currentLocaleId()) ? EN : ZH
      const template = dict[key] !== undefined ? dict[key] : ZH[key] !== undefined ? ZH[key] : key
      if (!params) return template
      return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
    }

    function subscribeLocale(fn) {
      localeListeners.add(fn)
      return () => localeListeners.delete(fn)
    }

    function localeSnapshot() {
      return localeRevision
    }

    function bumpLocale() {
      localeRevision += 1
      for (const fn of Array.from(localeListeners)) {
        try {
          fn()
        } catch {
          /* one listener must not break the rest */
        }
      }
    }

    function useLocale() {
      return useStore(subscribeLocale, localeSnapshot)
    }

    /* ================================================================== *
     * Host API
     * ================================================================== */

    const API = '/music/player'

    async function apiGet(action, query) {
      const suffix = query ? `?${new URLSearchParams(query).toString()}` : ''
      const response = await fetch(`${API}/${action}${suffix}`, { headers: { accept: 'application/json' } })
      const payload = await response.json().catch(() => null)
      if (!payload || payload.ok !== true) throw new Error((payload && payload.error) || `HTTP ${response.status}`)
      return payload.value
    }

    async function apiPost(action, body) {
      const response = await fetch(`${API}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
      const payload = await response.json().catch(() => null)
      if (!payload || payload.ok !== true) throw new Error((payload && payload.error) || `HTTP ${response.status}`)
      return payload.value
    }

    function streamUrl(provider, track) {
      return `${API}/stream?${new URLSearchParams({
        provider,
        id: track.id,
        name: track.name || '',
        artist: track.artist || '',
        album: track.album || '',
        duration: String(track.duration || 0),
      }).toString()}`
    }

    /* ================================================================== *
     * Storage helpers
     * ================================================================== */

    const PLAYER_KEY = 'dsh.music.player.v1'
    const OFFSET_PREFIX = 'dsh.music.lyricOffset.'

    function readStored(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key)
        return raw === null ? fallback : JSON.parse(raw)
      } catch {
        return fallback
      }
    }

    function writeStored(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        /* private mode: the session still plays, only the preference is lost */
      }
    }

    /* ================================================================== *
     * Lyrics
     * ================================================================== */

    function parseLyric(text) {
      const lines = []
      const source = String(text || '')
      const pattern = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
      for (const raw of source.split(/\r?\n/)) {
        const stamps = []
        let match
        pattern.lastIndex = 0
        while ((match = pattern.exec(raw))) {
          const fraction = match[3] ? Number(String(match[3]).padEnd(3, '0').slice(0, 3)) : 0
          stamps.push(Number(match[1]) * 60000 + Number(match[2]) * 1000 + fraction)
        }
        if (!stamps.length) continue
        const content = raw.replace(/\[[^\]]*\]/g, '').trim()
        if (!content) continue
        for (const time of stamps) lines.push({ time, text: content })
      }
      lines.sort((a, b) => a.time - b.time)
      return lines
    }

    function lyricIndexAt(lines, ms) {
      if (!lines.length) return -1
      let low = 0
      let high = lines.length - 1
      let found = -1
      while (low <= high) {
        const mid = (low + high) >> 1
        if (lines[mid].time <= ms) {
          found = mid
          low = mid + 1
        } else {
          high = mid - 1
        }
      }
      return found
    }

    /** The one lyric line the compact footer should show right now. */
    function currentLyric(state) {
      const lines = state.lyric || []
      if (!lines.length) return ''
      if (state.lyricIndex >= 0 && lines[state.lyricIndex]) return lines[state.lyricIndex].text
      const first = lines.find((line) => line.text)
      return first ? first.text : ''
    }

    /* ================================================================== *
     * Playback engine (module singleton so the dock survives re-registration)
     * ================================================================== */

    const engine = (() => {
      const stored = readStored(PLAYER_KEY, {})
      let audio = null
      const listeners = new Set()

      let state = {
        provider: null,
        playlist: null,
        queue: [],
        index: -1,
        track: null,
        mode: stored.mode === 'shuffle' || stored.mode === 'single' ? stored.mode : 'order',
        playing: false,
        loading: false,
        error: '',
        /** Minimized by default: the floating dock shows the now-playing card. */
        panelOpen: stored.panelOpen === true,
        /** Where the sidebar footer buttons are, so the panel opens over them. */
        panelAnchor: null,
        /** The sidebar is wide: the floating dock is the minimized player. */
        wide: true,
        /** Content box of the sidebar footer row; the dock sits just above it. */
        footerRect: null,
        /** Provider whose sign-in dialog is open; rendered in the overlay layer. */
        dialog: null,
        hover: false,
        tab: 'now',
        lyric: [],
        lyricIndex: -1,
        offset: 0,
        time: 0,
        duration: 0,
        volume: typeof stored.volume === 'number' ? Math.min(1, Math.max(0, stored.volume)) : 0.9,
        libraryOpen: false,
        lyricsMode: stored.lyricsMode === 'block' ? 'block' : 'line',
      }

      function emit() {
        for (const fn of Array.from(listeners)) {
          try {
            fn()
          } catch {
            /* ignore a broken subscriber */
          }
        }
      }

      function set(patch) {
        state = { ...state, ...patch }
        emit()
      }

      function get() {
        return state
      }

      function persist() {
        writeStored(PLAYER_KEY, {
          mode: state.mode,
          volume: state.volume,
          panelOpen: state.panelOpen,
          lyricsMode: state.lyricsMode,
        })
      }

      function offsetKey(provider, track) {
        return `${OFFSET_PREFIX}${provider || ''}:${track ? track.id : ''}`
      }

      function ensureAudio() {
        if (audio) return audio
        audio = new Audio()
        audio.preload = 'auto'
        audio.volume = state.volume
        audio.addEventListener('timeupdate', () => {
          const time = audio.currentTime || 0
          const nextIndex = lyricIndexAt(state.lyric, time * 1000 + state.offset)
          if (nextIndex !== state.lyricIndex || Math.abs(time - state.time) > 0.4) {
            set({ time, lyricIndex: nextIndex })
          }
        })
        audio.addEventListener('loadedmetadata', () => set({ duration: Number(audio.duration) || 0 }))
        audio.addEventListener('playing', () => set({ playing: true, loading: false }))
        audio.addEventListener('pause', () => set({ playing: false }))
        audio.addEventListener('ended', () => onEnded())
        audio.addEventListener('error', () => {
          if (!audio || !audio.getAttribute('src')) return
          if (state.loading) {
            set({ loading: false, playing: false, error: t('notPlayable', { reason: 'audio' }) })
          }
        })
        return audio
      }

      async function loadTrack(provider, playlist, track, autoplay) {
        const player = ensureAudio()
        set({
          provider,
          playlist: playlist || state.playlist,
          track,
          loading: true,
          error: '',
          lyric: [],
          lyricIndex: -1,
          time: 0,
          duration: 0,
          offset: readStored(offsetKey(provider, track), 0) || 0,
        })

        let resolved
        try {
          resolved = await apiPost('audio', { provider, track })
        } catch (error) {
          set({ loading: false, error: t('notPlayable', { reason: error && error.message ? error.message : String(error) }) })
          return
        }
        if (!state.track || state.track.id !== track.id) return
        if (!resolved || !resolved.url) {
          set({ loading: false, error: t('notPlayable', { reason: (resolved && resolved.reason) || 'no url' }) })
          return
        }

        player.src = streamUrl(provider, track)
        player.load()
        if (autoplay !== false) {
          try {
            await player.play()
            set({ playing: true, loading: false })
          } catch {
            set({ playing: false, loading: false })
          }
        } else {
          set({ loading: false })
        }
        loadLyric(provider, track)
      }

      async function loadLyric(provider, track) {
        try {
          const text = await apiPost('lyric', { provider, track })
          if (!state.track || state.track.id !== track.id) return
          const lines = parseLyric(text)
          set({ lyric: lines, lyricIndex: lyricIndexAt(lines, state.time * 1000 + state.offset) })
        } catch {
          if (!state.track || state.track.id !== track.id) return
          set({ lyric: [] })
        }
      }

      function playIndex(index, options) {
        if (!state.queue.length) return undefined
        const size = state.queue.length
        const next = ((index % size) + size) % size
        set({ index: next })
        return loadTrack(state.provider, state.playlist, state.queue[next], !options || options.autoplay !== false)
      }

      function randomIndex() {
        const size = state.queue.length
        if (size <= 1) return 0
        let candidate = state.index
        while (candidate === state.index) candidate = Math.floor(Math.random() * size)
        return candidate
      }

      function onEnded() {
        if (!state.queue.length) {
          set({ playing: false })
          return
        }
        if (state.mode === 'single') {
          const player = ensureAudio()
          player.currentTime = 0
          player.play().catch(() => set({ playing: false }))
          return
        }
        if (state.mode === 'shuffle') {
          playIndex(randomIndex())
          return
        }
        if (state.index >= state.queue.length - 1) {
          set({ playing: false, time: state.duration })
          return
        }
        playIndex(state.index + 1)
      }

      const api = {
        subscribe(fn) {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
        snapshot() {
          return state
        },
        setHover(value) {
          if (state.hover === value) return
          set({ hover: value })
        },
        setPanel(value) {
          set({ panelOpen: value })
          persist()
        },
        setPanelAnchor(anchor) {
          set({ panelAnchor: anchor })
        },
        setWide(value) {
          const next = value !== false
          if (state.wide === next) return
          set({ wide: next })
        },
        setFooterRect(rect) {
          set({ footerRect: rect })
        },
        setDialog(provider) {
          set({ dialog: provider })
        },
        setTab(tab) {
          set({ tab })
        },
        setLibraryOpen(value) {
          set({ libraryOpen: value, tab: value ? 'library' : 'now' })
        },
        setLyricsMode(mode) {
          set({ lyricsMode: mode === 'block' ? 'block' : 'line' })
          persist()
        },
        setMode(mode) {
          const next = mode === 'shuffle' || mode === 'single' ? mode : 'order'
          set({ mode: next })
          persist()
        },
        cycleMode() {
          const order = ['order', 'shuffle', 'single']
          api.setMode(order[(order.indexOf(state.mode) + 1) % order.length])
        },
        setVolume(value) {
          const volume = Math.min(1, Math.max(0, value))
          const player = ensureAudio()
          player.volume = volume
          set({ volume })
          persist()
        },
        seek(seconds) {
          const player = ensureAudio()
          try {
            player.currentTime = Math.max(0, Math.min(seconds, state.duration || seconds))
          } catch {
            /* not seekable yet */
          }
        },
        nudgeOffset(delta) {
          const next = Math.round((state.offset + delta) / 100) * 100
          set({ offset: next, lyricIndex: lyricIndexAt(state.lyric, state.time * 1000 + next) })
          if (state.track) writeStored(offsetKey(state.provider, state.track), next)
        },
        playQueue(provider, playlist, tracks, startIndex) {
          if (!tracks || !tracks.length) return undefined
          const index = Math.min(Math.max(0, startIndex || 0), tracks.length - 1)
          state = { ...state, provider, playlist: playlist || null, queue: tracks.slice(), index }
          emit()
          return loadTrack(provider, playlist, tracks[index], true)
        },
        toggle() {
          if (!state.track) return
          const player = ensureAudio()
          if (state.playing) {
            player.pause()
            set({ playing: false })
            return
          }
          if (!player.getAttribute('src')) {
            playIndex(state.index)
            return
          }
          player.play().catch(() => set({ playing: false }))
        },
        next(manual) {
          if (!state.queue.length) return
          if (state.mode === 'shuffle' && !manual) return playIndex(randomIndex())
          return playIndex(state.index + 1)
        },
        previous() {
          if (!state.queue.length) return
          if (state.mode === 'shuffle') return playIndex(randomIndex())
          return playIndex(state.index - 1)
        },
        getState() {
          return state
        },
      }
      return api
    })()

    function useEngine() {
      return useStore(engine.subscribe, engine.snapshot)
    }

    /* ================================================================== *
     * Library store
     * ================================================================== */

    const lib = (() => {
      let state = {
        ready: false,
        error: '',
        busy: '',
        providers: {},
        open: null,
        logging: null,
        active: 'netease',
      }
      const listeners = new Set()

      function set(patch) {
        state = { ...state, ...patch }
        for (const fn of Array.from(listeners)) {
          try {
            fn()
          } catch {
            /* ignore */
          }
        }
      }

      function apply(states) {
        const providers = {}
        for (const item of states || []) providers[item.id] = item
        set({ providers, ready: true })
      }

      async function refresh() {
        try {
          apply(await apiGet('state'))
        } catch (error) {
          set({ ready: true, error: error && error.message ? error.message : String(error) })
        }
      }

      /**
       * First open only: the Host keeps the accounts, so this rebuilds their
       * libraries once instead of on every poll.
       */
      let hydrated = false
      async function hydrate() {
        if (hydrated) return
        hydrated = true
        try {
          apply(await apiGet('hydrate'))
        } catch {
          hydrated = false
        }
      }
      async function signIn(provider, cookie) {
        set({ busy: provider })
        try {
          const value = await apiPost('sign-in', { provider, credentials: { mode: 'cookie', cookie } })
          set({ providers: { ...state.providers, [provider]: value }, busy: '', logging: null })
          return null
        } catch (error) {
          set({ busy: '' })
          return error && error.message ? error.message : String(error)
        }
      }

      async function signOut(provider) {
        set({ busy: provider })
        try {
          const value = await apiPost('sign-out', { provider })
          set({ providers: { ...state.providers, [provider]: value }, busy: '', open: null })
        } catch (error) {
          set({ busy: '', error: error && error.message ? error.message : String(error) })
        }
      }

      async function sync(provider) {
        set({ busy: provider })
        try {
          const value = await apiPost('sync', { provider })
          set({ providers: { ...state.providers, [provider]: value }, busy: '' })
        } catch (error) {
          set({ busy: '', error: error && error.message ? error.message : String(error) })
        }
      }

      async function openPlaylist(provider, playlist) {
        set({ open: { provider, playlist, tracks: [], loading: true, error: '' } })
        try {
          const tracks = await apiPost('tracks', { provider, playlistId: playlist.id })
          set({ open: { provider, playlist, tracks: tracks || [], loading: false, error: '' } })
        } catch (error) {
          set({
            open: { provider, playlist, tracks: [], loading: false, error: error && error.message ? error.message : String(error) },
          })
        }
      }

      return {
        subscribe(fn) {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
        snapshot() {
          return state
        },
        refresh,
        hydrate,
        signIn,
        signOut,
        sync,
        openPlaylist,
        closePlaylist() {
          set({ open: null })
        },
        setLogging(provider) {
          set({ logging: provider })
        },
        setError(error) {
          set({ error })
        },
        setActive(id) {
          set({ active: id })
        },
      }
    })()

    function useLibrary() {
      return useStore(lib.subscribe, lib.snapshot)
    }

    /* ================================================================== *
     * Providers
     * ================================================================== */

    const PROVIDERS = [
      { id: 'netease', label: () => t('htm'), color: '#e5484d', qr: true, site: 'music.163.com' },
      { id: 'qq', label: () => t('qq'), color: '#22c55e', qr: true, site: 'y.qq.com', qrHint: 'qrWaitingQq' },
    ]

    function providerMeta(id) {
      return PROVIDERS.find((item) => item.id === id) || PROVIDERS[0]
    }

    function providerName(id) {
      return providerMeta(id).label()
    }

    /** QQ's ticket is scanned by the QQ or WeChat app, not the QQ Music app. */
    function qrWaitingText(provider) {
      return provider.qrHint ? t(provider.qrHint) : t('qrWaiting', { app: providerName(provider.id) })
    }

    function helpFor(id) {
      return id === 'qq' ? t('helpQq') : t('helpNetease')
    }

    /* ================================================================== *
     * Icons
     * ================================================================== */

    const PATHS = {
      prev: 'M7 5v14M20 5.5l-9.5 6.5 9.5 6.5z',
      next: 'M17 5v14M4 5.5L13.5 12 4 18.5z',
      play: 'M8 4.5l12 7.5-12 7.5z',
      pause: 'M8.5 5h2.6v14H8.5zM13 5h2.6v14H13z',
      order: 'M4 7h10M4 12h7M4 17h10M17.5 13.5l3 2.5-3 2.5',
      shuffle: 'M4 7h3.2l8.6 10H19M4 17h3.2l3-3.6M18.6 4l2.4 2.5-2.4 2.5M16 14.5l2.6 2.5-2.6 2.5',
      single: 'M4 7h10M4 12h7M4 17h10M18.8 8.6l1.7-1v7.8',
      close: 'M6 6l12 12M18 6L6 18',
      down: 'M6 9.5l6 6 6-6',
      up: 'M6 14.5l6-6 6 6',
      refresh: 'M20 6.5v5h-5M4 17.5v-5h5M19.2 11a7.4 7.4 0 0 0-12.8-4M4.8 13a7.4 7.4 0 0 0 12.8 4',
      logout: 'M10 5H5.5v14H10M15 8.2l3.8 3.8-3.8 3.8M18.4 12H9.4',
      volume: 'M4 9.6v4.8h3l4 3.6V6L7 9.6zM16.2 9a4.2 4.2 0 0 1 0 6M18.8 6.4a8 8 0 0 1 0 11.2',
      disc: 'M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8zm0 5.6a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z',
      list: 'M4 6.5h9M4 12h9M4 17.5h9M17 5.5v9.2M17 17.6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
      music: 'M9 18V6l11-2v12M9 18a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0M20 16a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0',
      check: 'M5 12.5l4.5 4.5L19 7',
      alert: 'M12 4l9 16H3zM12 9.5v5M12 17.2v.1',
    }

    function Icon({ name, size = 18, strokeWidth = 1.9 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block', flex: '0 0 auto' },
        },
        h('path', { d: PATHS[name] || PATHS.music }),
      )
    }

    /* ================================================================== *
     * Shared bits
     * ================================================================== */

    function IconButton({ name, label, onClick, size = 18, disabled, className }) {
      return h(
        'button',
        {
          type: 'button',
          className: `mp-icon${className ? ` ${className}` : ''}`,
          title: label,
          'aria-label': label,
          disabled: disabled || undefined,
          onClick: (event) => {
            event.stopPropagation()
            if (!disabled && onClick) onClick(event)
          },
        },
        h(Icon, { name, size }),
      )
    }

    function Cover({ src, size, alt }) {
      const [broken, setBroken] = useState(false)
      useEffect(() => setBroken(false), [src])
      const dimension = { width: size, height: size, borderRadius: Math.round(size / 5) }
      if (!src || broken) {
        return h('div', { className: 'mp-cover mp-cover-empty', style: dimension, 'aria-hidden': true }, h(Icon, { name: 'music', size: Math.round(size * 0.5) }))
      }
      return h('img', {
        className: 'mp-cover',
        src,
        alt: alt || '',
        style: dimension,
        loading: 'lazy',
        draggable: false,
        onError: () => setBroken(true),
      })
    }

    function fmt(seconds) {
      const value = Math.max(0, Math.floor(Number(seconds) || 0))
      return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
    }

    function Spinner() {
      return h('span', { className: 'mp-spinner', 'aria-hidden': true })
    }

    /* ================================================================== *
     * Lyrics panel
     * ================================================================== */

    function LyricPanel({ state, variant }) {
      const lines = state.lyric
      const index = state.lyricIndex

      if (state.loading && !lines.length) {
        return h('div', { className: `mp-lyric mp-lyric-${variant} mp-lyric-note` }, h(Spinner), t('loadingSong'))
      }
      if (state.error) {
        return h(
          'div',
          { className: `mp-lyric mp-lyric-${variant} mp-lyric-note mp-lyric-error` },
          h(Icon, { name: 'alert', size: 15 }),
          h('span', null, state.error),
        )
      }
      if (!lines.length) {
        return h(
          'div',
          { className: `mp-lyric mp-lyric-${variant} mp-lyric-note` },
          h('div', { className: 'mp-lyric-title' }, state.track ? state.track.name : t('idle')),
          h('div', { className: 'mp-lyric-sub' }, state.track ? t('noLyric') : ''),
        )
      }

      if (variant === 'line') {
        const current = index >= 0 ? lines[index] : null
        const upcoming = index + 1 >= 0 && index + 1 < lines.length ? lines[index + 1] : null
        return h(
          'div',
          { className: 'mp-lyric mp-lyric-line' },
          h('div', { className: 'mp-lyric-current', title: current ? current.text : '' }, current ? current.text : lines[0].text),
          h('div', { className: 'mp-lyric-next', title: upcoming ? upcoming.text : '' }, upcoming ? upcoming.text : ''),
        )
      }

      const radius = 2
      const center = Math.max(0, index)
      const from = Math.max(0, Math.min(center - radius, Math.max(0, lines.length - (radius * 2 + 1))))
      const to = Math.min(lines.length, from + radius * 2 + 1)
      const rows = []
      for (let i = from; i < to; i += 1) {
        rows.push(
          h(
            'div',
            {
              key: i,
              className: `mp-lyric-row${i === index ? ' is-active' : ''}${i < index ? ' is-past' : ''}`,
              title: lines[i].text,
            },
            lines[i].text,
          ),
        )
      }
      return h('div', { className: 'mp-lyric mp-lyric-block' }, rows)
    }

    /* ================================================================== *
     * Login dialog
     * ================================================================== */

    function LoginDialog({ provider, onClose }) {
      useLocale()
      const [tab, setTab] = useState(provider.qr ? 'qr' : 'cookie')
      const [qr, setQr] = useState(null)
      const [qrState, setQrState] = useState('loading')
      const [qrError, setQrError] = useState('')
      const [cookie, setCookie] = useState('')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const closedRef = useRef(false)
      const timerRef = useRef(null)
      const nonceRef = useRef(0)

      useEffect(() => {
        closedRef.current = false
        return () => {
          closedRef.current = true
          if (timerRef.current) clearTimeout(timerRef.current)
        }
      }, [])

      const startQr = useCallback(async () => {
        if (!provider.qr) return
        const nonce = ++nonceRef.current
        setQrState('loading')
        setQrError('')
        setQr(null)
        try {
          const value = await apiGet('login/qr/create', { provider: provider.id })
          if (closedRef.current || nonce !== nonceRef.current) return
          setQr(value)
          setQrState('waiting')
        } catch (err) {
          if (closedRef.current || nonce !== nonceRef.current) return
          setQrState('error')
          setQrError(err && err.message ? err.message : String(err))
        }
      }, [provider])

      useEffect(() => {
        if (tab !== 'qr' || !provider.qr) return undefined
        startQr()
        return () => {
          nonceRef.current += 1
        }
      }, [tab, provider, startQr])

      useEffect(() => {
        // Only 'expired' and 'error' end the loop: 'scanned' must keep
        // polling, or the confirm on the phone is never seen.
        if (tab !== 'qr' || !qr || qrState === 'expired' || qrState === 'error') return undefined
        const nonce = nonceRef.current
        const poll = async () => {
          if (closedRef.current || nonce !== nonceRef.current) return
          try {
            const value = await apiGet('login/qr/check', { provider: provider.id, key: qr.key })
            if (closedRef.current || nonce !== nonceRef.current) return
            if (value.state === 'confirmed') {
              await lib.refresh()
              if (!closedRef.current) onClose()
              return
            }
            if (value.state === 'failed') {
              setQrState('error')
              setQrError(value.message || t('qrFailed', { reason: '' }))
              return
            }
            if (value.state === 'scanned') setQrState('scanned')
            else if (value.state === 'expired') {
              setQrState('expired')
              return
            } else setQrState('waiting')
          } catch (err) {
            if (closedRef.current || nonce !== nonceRef.current) return
            setQrState('error')
            setQrError(err && err.message ? err.message : String(err))
            return
          }
          timerRef.current = setTimeout(poll, 2000)
        }
        timerRef.current = setTimeout(poll, 1500)
        return () => {
          if (timerRef.current) clearTimeout(timerRef.current)
        }
      }, [tab, qrState, qr, provider, onClose])

      const submitCookie = async () => {
        if (!cookie.trim()) return
        setBusy(true)
        setError('')
        const failure = await lib.signIn(provider.id, cookie.trim())
        setBusy(false)
        if (failure) setError(t('loginFailed', { reason: failure }))
        else onClose()
      }

      const qrBody = () => {
        if (qrState === 'error') {
          return h(
            'div',
            { className: 'mp-qr-state mp-qr-error' },
            h(Icon, { name: 'alert', size: 20 }),
            h('span', null, t('qrFailed', { reason: qrError })),
            h('button', { type: 'button', className: 'mp-btn mp-btn-ghost', onClick: startQr }, t('qrRefresh')),
          )
        }
        if (qrState === 'expired') {
          return h(
            'div',
            { className: 'mp-qr-state' },
            h('span', null, t('qrExpired')),
            h('button', { type: 'button', className: 'mp-btn mp-btn-ghost', onClick: startQr }, t('qrRefresh')),
          )
        }
        return h(
          'div',
          { className: 'mp-qr-state' },
          qr && qr.image
            ? h('img', { className: 'mp-qr-image', src: qr.image, alt: qrWaitingText(provider), width: 180, height: 180 })
            : h('div', { className: 'mp-qr-image mp-qr-placeholder' }, h(Spinner)),
          h(
            'div',
            { className: `mp-qr-hint${qrState === 'scanned' ? ' is-ok' : ''}` },
            qrState === 'scanned' ? t('qrScanned') : qrWaitingText(provider),
          ),
          h('div', { className: 'mp-qr-site' }, provider.site),
        )
      }

      return h(
        'div',
        {
          className: 'mp-modal-backdrop',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose()
          },
        },
        h(
          'div',
          { className: 'mp-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('loginTitle', { name: providerName(provider.id) }) },
          h(
            'div',
            { className: 'mp-modal-head' },
            h('span', { className: 'mp-provider-badge', style: { background: provider.color } }),
            h('span', { className: 'mp-modal-title' }, t('loginTitle', { name: providerName(provider.id) })),
            h(IconButton, { name: 'close', label: t('close'), onClick: onClose }),
          ),
          h(
            'div',
            { className: 'mp-modal-tabs' },
            provider.qr
              ? h(
                  'button',
                  { type: 'button', className: `mp-seg${tab === 'qr' ? ' is-active' : ''}`, onClick: () => setTab('qr') },
                  t('qrTab'),
                )
              : null,
            h(
              'button',
              { type: 'button', className: `mp-seg${tab === 'cookie' ? ' is-active' : ''}`, onClick: () => setTab('cookie') },
              t('cookieTab'),
            ),
          ),
          h(
            'div',
            { className: 'mp-modal-body' },
            tab === 'qr'
              ? qrBody()
              : h(
                  'div',
                  { className: 'mp-cookie-form' },
                  h('div', { className: 'mp-help' }, helpFor(provider.id)),
                  h('textarea', {
                    className: 'mp-input',
                    rows: 4,
                    value: cookie,
                    spellCheck: false,
                    placeholder: t('cookiePlaceholder'),
                    onChange: (event) => setCookie(event.target.value),
                  }),
                  error ? h('div', { className: 'mp-error' }, error) : null,
                  h(
                    'div',
                    { className: 'mp-modal-actions' },
                    h('button', { type: 'button', className: 'mp-btn mp-btn-ghost', onClick: onClose }, t('cancel')),
                    h(
                      'button',
                      { type: 'button', className: 'mp-btn mp-btn-primary', disabled: busy || !cookie.trim(), onClick: submitCookie },
                      busy ? h(Spinner) : null,
                      busy ? t('loading') : t('cookieSubmit'),
                    ),
                  ),
                ),
          ),
        ),
      )
    }

    /* ================================================================== *
     * Playlist browser
     * ================================================================== */

    function PlaylistRows({ items, onOpen, active }) {
      const created = items.filter((item) => item.created)
      const collected = items.filter((item) => !item.created)
      const row = (item) =>
        h(
          'button',
          {
            key: item.id,
            type: 'button',
            className: 'mp-playlist',
            onClick: () => onOpen(item),
            title: item.name,
          },
          h(Cover, { src: item.cover, size: 34, alt: item.name }),
          h(
            'span',
            { className: 'mp-playlist-text' },
            h('span', { className: 'mp-playlist-name' }, item.name),
            h('span', { className: 'mp-playlist-count' }, t('songCount', { count: item.count || 0 })),
          ),
        )
      return h(
        'div',
        { className: 'mp-groups' },
        created.length
          ? h('div', { className: 'mp-group' }, h('div', { className: 'mp-group-title' }, t('created')), created.map(row))
          : null,
        collected.length
          ? h('div', { className: 'mp-group' }, h('div', { className: 'mp-group-title' }, t('collected')), collected.map(row))
          : null,
        !created.length && !collected.length ? h('div', { className: 'mp-empty' }, t('noPlaylists')) : null,
      )
    }

    function PlaylistBrowser({ onPick, compact }) {
      useLocale()
      const store = useLibrary()
      const active = store.active || 'netease'
      const provider = providerMeta(active)

      const value = store.providers[active]
      const open = store.open && store.open.provider === active ? store.open : null

      const tabs = h(
        'div',
        { className: 'mp-provider-tabs' },
        PROVIDERS.map((item) =>
          h(
            'button',
            {
              key: item.id,
              type: 'button',
              className: `mp-ptab${item.id === active ? ' is-active' : ''}`,
              onClick: () => {
                lib.setActive(item.id)
                lib.closePlaylist()
              },
            },
            h('span', {
              className: `mp-dot${
                store.providers[item.id] && store.providers[item.id].signedIn ? ' is-on' : ''
              }`,
              style: { color: item.color, borderColor: item.color },
            }),
            item.label(),
          ),
        ),
      )

      const openPlaylist = (item) => {
        lib.openPlaylist(active, item)
      }

      let body
      if (!store.ready) {
        body = h('div', { className: 'mp-empty' }, h(Spinner), t('loading'))
      } else if (open && open.loading) {
        body = h('div', { className: 'mp-empty' }, h(Spinner), t('loading'))
      } else if (open && open.error) {
        body = h('div', { className: 'mp-empty mp-error' }, open.error)
      } else if (open) {
        body = h(
          'div',
          { className: 'mp-tracks' },
          h(
            'div',
            { className: 'mp-tracks-head' },
            h('button', { type: 'button', className: 'mp-link', onClick: () => lib.closePlaylist() }, `‹ ${t('back')}`),
            h('span', { className: 'mp-tracks-title', title: open.playlist.name }, open.playlist.name),
            open.tracks.length
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'mp-link',
                    onClick: () => {
                      engine.playQueue(open.provider, open.playlist, open.tracks, 0)
                      if (onPick) onPick()
                    },
                  },
                  t('playAll'),
                )
              : null,
          ),
          open.tracks.length === 0
            ? h('div', { className: 'mp-empty' }, t('emptyPlaylist'))
            : h(
                'div',
                { className: 'mp-track-list' },
                open.tracks.map((track, index) =>
                  h(
                    'button',
                    {
                      key: `${track.id}:${index}`,
                      type: 'button',
                      className: 'mp-track',
                      onClick: () => {
                        engine.playQueue(open.provider, open.playlist, open.tracks, index)
                        if (onPick) onPick()
                      },
                      title: `${track.name}${track.artist ? ` — ${track.artist}` : ''}`,
                    },
                    h('span', { className: 'mp-track-no' }, String(index + 1)),
                    h(
                      'span',
                      { className: 'mp-track-text' },
                      h('span', { className: 'mp-track-name' }, track.name),
                      h('span', { className: 'mp-track-artist' }, track.artist || ''),
                    ),
                    track.duration ? h('span', { className: 'mp-track-time' }, fmt(track.duration / 1000)) : null,
                  ),
                ),
              ),
        )
      } else if (!value || !value.signedIn) {
        body = h(
          'div',
          { className: 'mp-empty mp-empty-signin' },
          h('div', { className: 'mp-empty-title' }, t('signInHint')),
          h('button', { type: 'button', className: 'mp-btn mp-btn-primary', onClick: () => lib.setLogging(active) }, t('signIn')),
        )
      } else {
        const lists = value.playlists || []
        body = h(
          'div',
          { className: 'mp-account' },
          h(
            'div',
            { className: 'mp-account-head' },
            h(Cover, { src: value.account && value.account.avatar, size: 34, alt: '' }),
            h(
              'div',
              { className: 'mp-account-text' },
              h('div', { className: 'mp-account-name' }, (value.account && value.account.name) || providerName(active)),
              h('div', { className: 'mp-account-sub' }, t('songCount', { count: lists.length })),
            ),
            h(IconButton, {
              name: 'refresh',
              label: t('refresh'),
              size: 16,
              disabled: store.busy === active,
              onClick: () => lib.sync(active),
            }),
            h(IconButton, {
              name: 'logout',
              label: t('signOut'),
              size: 16,
              onClick: () => {
                if (window.confirm(t('signOutConfirm'))) lib.signOut(active)
              },
            }),
          ),
          value.warning ? h('div', { className: 'mp-warn' }, value.warning) : null,
          h(PlaylistRows, { items: lists, active, onOpen: openPlaylist }),
        )
      }

      return h('div', { className: `mp-browser${compact ? ' is-compact' : ''}` }, tabs, body)
    }

    /* ================================================================== *
     * Dock (bottom-left player)
     * ================================================================== */

    function ModeLabel({ mode }) {
      if (mode === 'shuffle') return t('modeShuffle')
      if (mode === 'single') return t('modeSingle')
      return t('modeOrder')
    }

    /* ---------------------------------------------------------------- *
     * Sidebar footer player
     * ---------------------------------------------------------------- */

    function PlayerPanel({ onMinimize, style, panelRef }) {
      const state = useEngine()
      const hoverTimer = useRef(null)

      const onEnter = () => {
        if (hoverTimer.current) {
          clearTimeout(hoverTimer.current)
          hoverTimer.current = null
        }
        engine.setHover(true)
      }
      const onLeave = () => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current)
        hoverTimer.current = setTimeout(() => engine.setHover(false), 120)
      }
      useEffect(() => () => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current)
      }, [])

      const showControls = state.hover || state.tab === 'library' || !state.track
      const title = state.track ? state.track.name : t('idle')
      const artist = state.track ? state.track.artist || state.track.album || '' : t('signInHint')

      const hairline = h(
        'div',
        { className: 'mp-progress-line' },
        h('div', {
          className: 'mp-progress-fill',
          style: { width: `${state.duration ? Math.min(100, (state.time / state.duration) * 100) : 0}%` },
        }),
      )

      const transport = h(
        'div',
        { className: 'mp-transport' },
        h(IconButton, {
          name: state.mode === 'shuffle' ? 'shuffle' : state.mode === 'single' ? 'single' : 'order',
          label: t('modeHint', { mode: ModeLabel({ mode: state.mode }) }),
          size: 16,
          className: 'mp-mode',
          onClick: () => engine.cycleMode(),
        }),
        h(IconButton, { name: 'prev', label: t('previous'), disabled: !state.track, onClick: () => engine.previous() }),
        h(
          'button',
          {
            type: 'button',
            className: 'mp-main-btn',
            title: state.playing ? t('pause') : t('play'),
            'aria-label': state.playing ? t('pause') : t('play'),
            disabled: !state.track,
            onClick: (event) => {
              event.stopPropagation()
              engine.toggle()
            },
          },
          state.loading && !state.playing ? h(Spinner) : h(Icon, { name: state.playing ? 'pause' : 'play', size: 19 }),
        ),
        h(IconButton, { name: 'next', label: t('next'), disabled: !state.track, onClick: () => engine.next(true) }),
        h(
          'span',
          { className: 'mp-volume' },
          h(Icon, { name: 'volume', size: 15 }),
          h('input', {
            type: 'range',
            min: 0,
            max: 1,
            step: 0.01,
            value: state.volume,
            'aria-label': t('volume'),
            onClick: (event) => event.stopPropagation(),
            onChange: (event) => engine.setVolume(Number(event.target.value)),
          }),
        ),
      )

      const progress = h(
        'div',
        { className: 'mp-progress-row' },
        h('span', { className: 'mp-time' }, fmt(state.time)),
        h(
          'div',
          {
            className: 'mp-progress',
            role: 'slider',
            tabIndex: 0,
            'aria-label': t('now'),
            'aria-valuemin': 0,
            'aria-valuemax': Math.round(state.duration || 0),
            'aria-valuenow': Math.round(state.time || 0),
            onKeyDown: (event) => {
              if (event.key === 'ArrowLeft') engine.seek(state.time - 5)
              if (event.key === 'ArrowRight') engine.seek(state.time + 5)
            },
            onClick: (event) => {
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
              engine.seek(ratio * (state.duration || 0))
            },
          },
          h('div', {
            className: 'mp-progress-fill',
            style: { width: `${state.duration ? Math.min(100, (state.time / state.duration) * 100) : 0}%` },
          }),
        ),
        h('span', { className: 'mp-time' }, fmt(state.duration)),
      )

      const headerRow = h(
        'div',
        { className: 'mp-head' },
        h(Cover, { src: state.track && state.track.cover, size: 42, alt: title }),
        h(
          'div',
          { className: 'mp-head-text' },
          h('div', { className: 'mp-title', title }, title),
          h('div', { className: 'mp-artist', title: artist }, artist),
        ),
        h(
          'div',
          { className: 'mp-head-actions' },
          h(IconButton, {
            name: 'list',
            label: t('library'),
            size: 17,
            className: state.tab === 'library' ? 'is-on' : '',
            onClick: () => engine.setTab(state.tab === 'library' ? 'now' : 'library'),
          }),
          h(IconButton, { name: 'down', label: t('minimize'), size: 17, onClick: onMinimize }),
        ),
      )

      const bodyArea =
        state.tab === 'library'
          ? h(PlaylistBrowser, { compact: true })
          : h(
              'div',
              { className: 'mp-body' },
              state.track && !showControls
                ? h(LyricPanel, { state, variant: 'block' })
                : state.track
                  ? h(
                      'div',
                      { className: 'mp-controls-face' },
                      progress,
                      transport,
                      h('div', { className: 'mp-hint' }, state.hover ? t('hoverHint') : ''),
                    )
                  : h('div', { className: 'mp-idle' }, h(Icon, { name: 'music', size: 26 }), h('span', null, t('idle'))),
            )

      return h(
        'div',
        {
          className: 'mp-panel',
          ref: panelRef,
          style,
          onPointerEnter: onEnter,
          onPointerLeave: onLeave,
          onFocusCapture: onEnter,
          onBlurCapture: onLeave,
        },
        hairline,
        headerRow,
        bodyArea,
      )
    }

    /**
     * Registered in `sidebar.footer.action`. With a wide sidebar the minimized
     * player lives in the floating dock (rendered from `shell.overlay`) and this
     * slot stays empty; the 56px rail has no room for the dock, so there it
     * falls back to one button that opens the expanded panel.
     */
    function MusicFooter({ wide }) {
      useLocale()
      const state = useEngine()
      const rootRef = useRef(null)

      useEffect(() => {
        engine.setWide(wide !== false)
      }, [wide])

      useEffect(() => {
        // Accounts restored by the Host have no library yet; this asks for the
        // one-time rebuild, then the poll keeps the dock in step.
        lib.hydrate()
      }, [])

      useEffect(() => {
        const timer = setInterval(() => {
          lib.refresh()
        }, 6000)
        return () => clearInterval(timer)
      }, [])

      const publishAnchor = () => {
        const node = rootRef.current
        if (!node || typeof node.getBoundingClientRect !== 'function') return
        const rect = node.getBoundingClientRect()
        engine.setPanelAnchor({ left: Math.round(rect.left), top: Math.round(rect.top) })
      }

      // The dock is embedded flush above this row, so it needs the column's own
      // content box: the slot cell is zero-sized and the row itself may hug its
      // buttons, so measure the footer block (the row's parent) when it exists.
      const publishFooter = () => {
        const node = rootRef.current
        if (!node) return
        const candidates = [node.parentElement, node.parentElement && node.parentElement.parentElement]
          .filter(Boolean)
          .map((element) => element.getBoundingClientRect())
          .filter((box) => box.width > 60 && box.width < 460)
        if (!candidates.length) return
        const box = candidates[candidates.length - 1]
        engine.setFooterRect({ left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width) })
      }

      useEffect(() => {
        if (wide === false) return undefined
        publishFooter()
        window.addEventListener('resize', publishFooter)
        return () => window.removeEventListener('resize', publishFooter)
      }, [wide])

      useEffect(() => {
        if (wide !== false) return undefined
        publishAnchor()
        window.addEventListener('resize', publishAnchor)
        return () => window.removeEventListener('resize', publishAnchor)
      }, [wide])

      // Wide: leave a zero-sized cell in the footer row so the dock can align to
      // it; the row itself stays free for the other plugins' buttons.
      if (wide !== false) return h('div', { className: 'mp-anchor', ref: rootRef })

      return h(
        'div',
        { className: 'mp-root is-rail', ref: rootRef, onPointerDownCapture: publishAnchor },
        h(
          'div',
          { className: 'mp-cluster' },
          h(
            'button',
            {
              type: 'button',
              className: 'mp-cluster-play',
              title: state.playing ? t('pause') : t('expand'),
              'aria-label': state.playing ? t('pause') : t('expand'),
              onClick: () => {
                publishAnchor()
                engine.setPanel(true)
              },
            },
            h(Icon, { name: state.track && state.playing ? 'pause' : 'music', size: 13 }),
          ),
        ),
      )
    }

    /**
     * The minimized player, embedded flush above the sidebar footer row: same
     * column width and fill as the sidebar, a hairline on top, and pinned just
     * above the other plugins' footer buttons so it never covers them.
     *
     * With the pointer away it shows cover, title, the current lyric line and a
     * progress hairline; pointer-over crossfades the lyric into the transport
     * buttons, so nothing snaps between states.
     */
    function MiniDock() {
      useLocale()
      const state = useEngine()
      const dockRef = useRef(null)
      const leaveTimer = useRef(null)
      const [hovered, setHovered] = useState(false)

      // The expanded panel opens right above the dock, so publish where it is.
      useEffect(() => {
        const publish = () => {
          const node = dockRef.current
          if (!node || typeof node.getBoundingClientRect !== 'function') return
          const rect = node.getBoundingClientRect()
          engine.setPanelAnchor({ left: Math.round(rect.left), top: Math.round(rect.top) })
        }
        publish()
        window.addEventListener('resize', publish)
        return () => window.removeEventListener('resize', publish)
      }, [])

      useEffect(
        () => () => {
          if (leaveTimer.current) clearTimeout(leaveTimer.current)
        },
        [],
      )

      const enter = () => {
        if (leaveTimer.current) {
          clearTimeout(leaveTimer.current)
          leaveTimer.current = null
        }
        setHovered(true)
      }
      const leave = () => {
        if (leaveTimer.current) clearTimeout(leaveTimer.current)
        leaveTimer.current = setTimeout(() => setHovered(false), 140)
      }

      const expand = () => {
        const node = dockRef.current
        if (node && typeof node.getBoundingClientRect === 'function') {
          const rect = node.getBoundingClientRect()
          engine.setPanelAnchor({ left: Math.round(rect.left), top: Math.round(rect.top) })
        }
        engine.setPanel(true)
      }

      const track = state.track
      const title = track ? track.name : t('idle')
      const line = track ? currentLyric(state) || track.artist || track.album || t('noLyric') : t('signInHint')
      const modeIcon = state.mode === 'shuffle' ? 'shuffle' : state.mode === 'single' ? 'single' : 'order'
      const progress = state.duration ? Math.min(100, (state.time / state.duration) * 100) : 0

      // Align with the sidebar's content box and pin just above its footer row.
      const footer = state.footerRect
      const dockStyle = footer
        ? {
            left: `${footer.left}px`,
            width: `${footer.width}px`,
            bottom: `${Math.max(8, window.innerHeight - footer.top + 8)}px`,
          }
        : { left: '12px', width: '266px', bottom: '64px' }

      return h(
        'div',
        {
          className: 'mp-dock',
          style: dockStyle,
          ref: dockRef,
          onPointerEnter: enter,
          onPointerMove: enter,
          onPointerLeave: leave,
        },
        h(
          'button',
          { type: 'button', className: 'mp-dock-cover', onClick: expand, title: t('expand'), 'aria-label': t('expand') },
          h(Cover, { src: track && track.cover, size: 38, alt: title }),
        ),
        h(
          'div',
          { className: 'mp-dock-body' },
          h(
            'div',
            { className: 'mp-dock-title' },
            // Red marks a member/paid track, blue an ordinary one; grey while
            // nothing is loaded. This is the track's own pay flag, not the
            // current playback state, so it survives pause.
            h('span', {
              className: `mp-dock-dot${track ? (track.vip ? ' is-vip' : ' is-free') : ''}`,
              title: track ? (track.vip ? t('vipTrack') : t('freeTrack')) : '',
            }),
            h('span', { className: 'mp-dock-name' }, title),
          ),
          h(
            'div',
            { className: 'mp-dock-swap' },
            h(
              'button',
              {
                type: 'button',
                className: `mp-dock-layer mp-dock-lyric${hovered ? ' is-out' : ''}`,
                'aria-hidden': hovered,
                tabIndex: hovered ? -1 : 0,
                title: line,
                onClick: expand,
              },
              line,
            ),
            h(
              'div',
              { className: `mp-dock-layer mp-dock-controls${hovered ? '' : ' is-out'}`, 'aria-hidden': !hovered },
              h(
                'div',
                { className: 'mp-cluster' },
                h(IconButton, {
                  name: 'prev',
                  label: t('previous'),
                  size: 15,
                  disabled: !track,
                  onClick: () => engine.previous(),
                }),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mp-cluster-play',
                    title: state.playing ? t('pause') : t('play'),
                    'aria-label': state.playing ? t('pause') : t('play'),
                    disabled: !track,
                    onClick: () => engine.toggle(),
                  },
                  state.loading && !state.playing
                    ? h(Spinner)
                    : h(Icon, { name: state.playing ? 'pause' : 'play', size: 13 }),
                ),
                h(IconButton, {
                  name: 'next',
                  label: t('next'),
                  size: 15,
                  disabled: !track,
                  onClick: () => engine.next(true),
                }),
                h(IconButton, {
                  name: modeIcon,
                  label: t('modeHint', { mode: ModeLabel({ mode: state.mode }) }),
                  size: 15,
                  className: 'mp-mode-on',
                  onClick: () => engine.cycleMode(),
                }),
                h(IconButton, { name: 'up', label: t('expand'), size: 15, onClick: expand }),
              ),
            ),
          ),
        ),
        track && state.duration
          ? h('div', { className: 'mp-dock-progress' }, h('div', { className: 'mp-dock-progress-fill', style: { width: `${progress}%` } }))
          : null,
      )
    }

    /**
     * The floating layer: the minimized dock, the expanded player panel and the
     * sign-in dialog, drawn from `shell.overlay` so they stack above every
     * column. The layer is click-through by design, so this entry opts back into
     * pointer events only on its own surfaces.
     */
    function MusicOverlay() {
      useLocale()
      const state = useEngine()
      const store = useLibrary()
      const panelRef = useRef(null)
      const closeDialog = useCallback(() => engine.setDialog(null), [])

      useEffect(() => {
        const logging = store.logging
        if (!logging) return
        engine.setDialog(providerMeta(logging))
        lib.setLogging(null)
      }, [store.logging])

      // A click anywhere outside the panel closes it (back to the dock) — except
      // on the dock or the rail button, which live outside the panel subtree.
      useEffect(() => {
        if (!state.panelOpen && !state.dialog) return undefined
        const onDown = (event) => {
          const target = event.target
          if (panelRef.current && panelRef.current.contains(target)) return
          if (target && typeof target.closest === 'function' && (target.closest('.mp-root') || target.closest('.mp-dock'))) return
          if (state.dialog) return
          engine.setPanel(false)
        }
        document.addEventListener('pointerdown', onDown, true)
        return () => document.removeEventListener('pointerdown', onDown, true)
      }, [state.panelOpen, state.dialog])

      const anchor = state.panelAnchor
      const panelStyle = anchor
        ? {
            left: `${Math.min(anchor.left, Math.max(8, window.innerWidth - 336))}px`,
            bottom: `${Math.max(8, window.innerHeight - anchor.top + 8)}px`,
          }
        : undefined

      return h(
        'div',
        { className: 'mp-overlay' },
        state.wide ? h(MiniDock) : null,
        state.panelOpen
          ? h(PlayerPanel, {
              style: panelStyle,
              panelRef,
              onMinimize: () => engine.setPanel(false),
            })
          : null,
        state.dialog ? h(LoginDialog, { provider: state.dialog, onClose: closeDialog }) : null,
      )
    }


    /* ================================================================== *
     * Settings section
     * ================================================================== */

    function SettingsSection() {
      useLocale()
      const store = useLibrary()

      useEffect(() => {
        lib.hydrate()
      }, [])

      // The sign-in dialog is drawn from the overlay layer (above every column),
      // so the settings page only asks for it through the engine.
      const cards = PROVIDERS.map((item) => {
        const value = store.providers[item.id]
        const signed = value && value.signedIn
        const status = signed
          ? t('signedInAs', { name: (value.account && value.account.name) || item.label() })
          : t('notSignedIn')
        let action
        if (signed) {
          action = h(
            'div',
            { className: 'mp-card-actions' },
            h('button', { type: 'button', className: 'mp-btn mp-btn-ghost', onClick: () => lib.sync(item.id) }, t('refresh')),
            h('button', { type: 'button', className: 'mp-btn mp-btn-ghost', onClick: () => lib.signOut(item.id) }, t('signOut')),
          )
        } else {
          action = h(
            'button',
            { type: 'button', className: 'mp-btn mp-btn-primary', onClick: () => engine.setDialog(item) },
            t('signIn'),
          )
        }
        return h(
          'div',
          { key: item.id, className: 'mp-card' },
          h(
            'div',
            { className: 'mp-card-head' },
            h('span', { className: 'mp-provider-badge is-lg', style: { background: item.color } }),
            h(
              'div',
              { className: 'mp-card-text' },
              h('div', { className: 'mp-card-title' }, item.label()),
              h('div', { className: 'mp-card-sub' }, status),
            ),
            action,
          ),
          h('div', { className: 'mp-card-note' }, helpFor(item.id)),
          h('div', { className: 'mp-card-sites' }, item.site),
        )
      })

      return h(
        'div',
        { className: 'mp-settings' },
        h('h2', { className: 'mp-settings-title' }, t('settingsTitle')),
        h('p', { className: 'mp-settings-intro' }, t('settingsIntro')),
        h('div', { className: 'mp-cards' }, cards),
        h('div', { className: 'mp-settings-block' }, h(PlaylistBrowser, { compact: false })),
      )
    }

    /* ================================================================== *
     * Styles
     * ================================================================== */

    const CSS = `
.mp-panel, .mp-panel *, .mp-cluster, .mp-cluster *, .mp-settings, .mp-settings *, .mp-modal, .mp-modal * { box-sizing: border-box; }
/* The player lives in the sidebar footer; the expanded panel opens above it,
   anchored to the same bottom-left corner so it follows the sidebar column. */
.mp-panel {
  position: fixed; left: 12px; bottom: 62px; z-index: 45;
  width: 320px; max-width: calc(100vw - 24px);
  display: flex; flex-direction: column;
  pointer-events: auto;
  color: var(--dsw-alias-label-primary, #15171c);
  background: var(--dsw-alias-bg-overlay, #ffffff);
  border: 1px solid var(--dsw-alias-border-l1, rgba(16,18,24,.10));
  border-radius: 14px;
  box-shadow: 0 18px 44px -18px rgba(12,16,28,.45), 0 2px 8px rgba(12,16,28,.08);
  font: inherit; font-size: 13px; line-height: 1.45;
  overflow: hidden;
  animation: mp-rise .16s ease-out;
}
@keyframes mp-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.mp-root { display: flex; align-items: center; width: 100%; min-width: 0; }
.mp-root.is-rail { justify-content: center; }
/* Zero-sized cell in the footer row: only a measuring point for the dock, so
   the row keeps its space for the other plugins' buttons. */
.mp-anchor { width: 0; height: 0; flex: 0 0 auto; }

/* The minimized player, embedded above the sidebar footer row: same fill and
   column width as the sidebar, no frame or divider so it reads as part of the
   column rather than a card. */
.mp-dock {
  position: fixed; z-index: 44;
  display: flex; align-items: center; gap: 9px;
  padding: 9px 2px 10px;
  color: var(--dsw-alias-label-primary, #15171c);
  background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-overlay, #ffffff));
  pointer-events: auto;
  animation: mp-rise .16s ease-out;
}
.mp-dock-cover { border: 0; padding: 0; background: transparent; border-radius: 9px; cursor: pointer; flex: 0 0 auto; line-height: 0; overflow: hidden; }
.mp-dock-body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.mp-dock-title { display: flex; align-items: center; gap: 5px; min-width: 0; line-height: 16px; }
.mp-dock-name { min-width: 0; font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mp-dock-dot { width: 5px; height: 5px; border-radius: 50%; flex: 0 0 auto; background: var(--dsw-alias-label-secondary, #767b86); opacity: .5; }
.mp-dock-dot.is-free { background: var(--dsw-alias-brand-primary, #4d6bfe); opacity: 1; }
.mp-dock-dot.is-vip { background: var(--dsw-alias-state-error-primary, #d33b41); opacity: 1; }
/* Both faces stay mounted and crossfade, so hovering never snaps the layout. */
.mp-dock-swap { position: relative; height: 24px; min-width: 0; }
.mp-dock-layer { position: absolute; inset: 0; display: flex; align-items: center; min-width: 0; border: 0; background: transparent;
  color: inherit; font: inherit; padding: 0;
  opacity: 1; transform: none; transition: opacity .2s ease, transform .2s ease, visibility 0s linear 0s; }
.mp-dock-layer.is-out { opacity: 0; transform: translateY(5px); visibility: hidden; pointer-events: none;
  transition: opacity .2s ease, transform .2s ease, visibility 0s linear .2s; }
.mp-dock-lyric { display: block; font-size: 11px; line-height: 24px; color: var(--dsw-alias-label-secondary, #767b86);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; cursor: pointer; }
.mp-dock-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; overflow: hidden;
  background: var(--dsw-alias-bg-layer-2, rgba(16,18,24,.08)); }
.mp-dock-progress-fill { height: 100%; background: var(--dsw-alias-brand-primary, #4d6bfe); transition: width .2s linear; }
/* shell.overlay is click-through: only our own surfaces take pointer events. */
.mp-overlay { pointer-events: none; }
.mp-overlay .mp-panel, .mp-overlay .mp-modal-backdrop, .mp-overlay .mp-dock { pointer-events: auto; }
.mp-cluster { display: inline-flex; align-items: center; gap: 1px; }
.mp-cluster .mp-icon { padding: 4px; }
.mp-cluster-play { width: 24px; height: 24px; border-radius: 50%; border: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  color: #fff; background: var(--dsw-alias-brand-primary, #4d6bfe); flex: 0 0 auto; }
.mp-cluster-play:disabled { opacity: .45; cursor: default; }
.mp-cluster .mp-mode-on { color: var(--dsw-alias-brand-primary, #4d6bfe); opacity: 1; }
.mp-progress-line { height: 2px; background: var(--dsw-alias-bg-layer-2, rgba(16,18,24,.08)); flex: 0 0 auto; }
.mp-progress-line .mp-progress-fill { height: 100%; background: var(--dsw-alias-brand-primary, #4d6bfe); transition: width .2s linear; }
.mp-head { display: flex; align-items: center; gap: 9px; padding: 10px 10px 8px; }
.mp-cover-btn { border: 0; padding: 0; background: transparent; cursor: pointer; border-radius: 9px; flex: 0 0 auto; }
.mp-cover { object-fit: cover; display: block; background: var(--dsw-alias-bg-layer-2, rgba(16,18,24,.07)); }
.mp-cover-empty { display: flex; align-items: center; justify-content: center; color: var(--dsw-alias-label-secondary, #767b86); }
.mp-head-text { flex: 1 1 auto; min-width: 0; }
.mp-title { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mp-artist { font-size: 11.5px; color: var(--dsw-alias-label-secondary, #767b86); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mp-head-actions { display: flex; align-items: center; gap: 1px; flex: 0 0 auto; }
.mp-icon { border: 0; background: transparent; color: inherit; padding: 5px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; opacity: .82; }
.mp-icon:hover { background: var(--dsw-alias-bg-layer-2, rgba(16,18,24,.07)); opacity: 1; }
.mp-icon:disabled { opacity: .3; cursor: default; background: transparent; }
.mp-icon.is-on { color: var(--dsw-alias-brand-primary, #4d6bfe); opacity: 1; }
.mp-body { padding: 0 12px 10px; min-height: 132px; display: flex; flex-direction: column; }
.mp-body-library { min-height: 200px; max-height: 330px; overflow: auto; padding-top: 2px; }
.mp-controls-face { display: flex; flex-direction: column; gap: 8px; padding-top: 2px; }
.mp-progress-row { display: flex; align-items: center; gap: 8px; }
.mp-time { font-size: 10.5px; color: var(--dsw-alias-label-secondary, #767b86); font-variant-numeric: tabular-nums; min-width: 28px; }
.mp-progress-row .mp-time:last-child { text-align: right; }
.mp-progress { position: relative; flex: 1 1 auto; height: 4px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2, rgba(16,18,24,.10)); cursor: pointer; }
.mp-progress:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe); outline-offset: 3px; }
.mp-progress .mp-progress-fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--dsw-alias-brand-primary, #4d6bfe); }
.mp-transport { display: flex; align-items: center; justify-content: center; gap: 6px; }
.mp-main-btn { width: 38px; height: 38px; border-radius: 50%; border: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  color: #fff; background: var(--dsw-alias-brand-primary, #4d6bfe); box-shadow: 0 6px 14px -6px rgba(77,107,254,.9); }
.mp-main-btn:hover { filter: brightness(1.06); }
.mp-main-btn:disabled { opacity: .45; cursor: default; box-shadow: none; }
.mp-main-btn.is-small { width: 28px; height: 28px; }
.mp-volume { display: inline-flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-secondary, #767b86); margin-left: 4px; }
.mp-volume input { width: 52px; accent-color: var(--dsw-alias-brand-primary, #4d6bfe); cursor: pointer; }
.mp-hint { font-size: 10.5px; color: var(--dsw-alias-label-secondary, #767b86); text-align: center; min-height: 14px; }
.mp-idle { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; flex: 1 1 auto; color: var(--dsw-alias-label-secondary, #767b86); font-size: 12px; }
.mp-lyric { display: flex; flex-direction: column; justify-content: center; flex: 1 1 auto; min-height: 92px; overflow: hidden; }
.mp-lyric-note { align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary, #767b86); font-size: 11.5px; text-align: center; }
.mp-lyric-error { color: var(--dsw-alias-state-error-primary, #d33b41); }
.mp-lyric-title { font-size: 12.5px; font-weight: 600; color: var(--dsw-alias-label-primary, #15171c); }
.mp-lyric-sub { font-size: 11px; }
.mp-lyric-line { gap: 5px; align-items: flex-start; }
.mp-lyric-current { font-size: 14px; font-weight: 600; line-height: 1.4; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-lyric-next { font-size: 11.5px; color: var(--dsw-alias-label-secondary, #767b86); width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-lyric-block { gap: 5px; align-items: flex-start; }
.mp-lyric-row { font-size: 12px; line-height: 1.4; color: var(--dsw-alias-label-secondary, #767b86); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; transition: color .18s ease, opacity .18s ease; }
.mp-lyric-row.is-past { opacity: .42; }
.mp-lyric-row.is-active { color: var(--dsw-alias-brand-primary, #4d6bfe); font-weight: 600; font-size: 13.5px; opacity: 1; }
.mp-provider-tabs { display: flex; gap: 3px; margin-bottom: 8px; flex-wrap: wrap; }
.mp-ptab { border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #767b86); font: inherit; font-size: 11.5px; padding: 4px 8px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
.mp-ptab:hover { background: var(--dsw-alias-bg-layer-2, rgba(16,18,24,.06)); }
.mp-ptab.is-active { background: var(--dsw-alias-bg-layer-2, rgba(16,18,24,.08)); color: var(--dsw-alias-label-primary, #15171c); font-weight: 600; }
.mp-dot { width: 6px; height: 6px; border-radius: 50%; border: 1px solid currentColor; background: transparent; display: inline-block; }
.mp-dot.is-on { background: currentColor; }
.mp-account { display: flex; flex-direction: column; gap: 8px; }
.mp-account-head { display: flex; align-items: center; gap: 8px; }
.mp-account-text { flex: 1 1 auto; min-width: 0; }
.mp-account-name { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mp-account-sub { font-size: 10.5px; color: var(--dsw-alias-label-secondary, #767b86); }
.mp-group { margin-top: 2px; }
.mp-group-title { font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--dsw-alias-label-secondary, #767b86); margin: 6px 0 3px 2px; }
.mp-playlist, .mp-track { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; padding: 5px 6px; border-radius: 9px; cursor: pointer; }
.mp-playlist:hover, .mp-track:hover { background: var(--dsw-alias-bg-layer-2, rgba(16,18,24,.06)); }
.mp-playlist-text, .mp-track-text { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
.mp-playlist-name, .mp-track-name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mp-playlist-count, .mp-track-artist { font-size: 10.5px; color: var(--dsw-alias-label-secondary, #767b86); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mp-tracks { display: flex; flex-direction: column; min-height: 0; }
/* At most five rows are visible; the rest scroll without moving the header.
   --mp-track-h tracks the row's own padding + two text lines so the cut lands
   exactly between rows instead of slicing the sixth one in half. */
.mp-track-list {
  --mp-track-h: 42.6px;
  display: flex; flex-direction: column;
  max-height: calc(var(--mp-track-h) * 5);
  overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin;
}
/* Rows keep their height while the container scrolls instead of being squeezed
   by flex-shrink. */
.mp-track-list .mp-track { flex: 0 0 auto; }
/* The settings page inherits the app's line-height instead of the panel's 1.45,
   so it gets a little slack: five rows stay whole with a sliver of the sixth
   visible as a scroll hint. */
.mp-settings .mp-track-list { --mp-track-h: 48px; }
.mp-tracks-head { display: flex; align-items: center; gap: 8px; padding: 0 2px 6px; }
.mp-tracks-title { flex: 1 1 auto; min-width: 0; font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mp-track-no { width: 16px; text-align: right; font-size: 10.5px; color: var(--dsw-alias-label-secondary, #767b86); font-variant-numeric: tabular-nums; }
.mp-track-time { font-size: 10.5px; color: var(--dsw-alias-label-secondary, #767b86); font-variant-numeric: tabular-nums; }
.mp-link { border: 0; background: transparent; color: var(--dsw-alias-brand-primary, #4d6bfe); font: inherit; font-size: 11.5px; cursor: pointer; padding: 2px 3px; border-radius: 6px; }
.mp-link:hover { background: var(--dsw-alias-bg-layer-2, rgba(16,18,24,.06)); }
.mp-empty { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 22px 8px; color: var(--dsw-alias-label-secondary, #767b86); font-size: 11.5px; text-align: center; }
.mp-empty-signin { flex-direction: column; gap: 10px; }
.mp-empty-title { font-size: 11.5px; line-height: 1.5; }
.mp-error { color: var(--dsw-alias-state-error-primary, #d33b41); }
.mp-warn { color: var(--dsw-alias-state-warn-primary, #b26a00); font-size: 11px; line-height: 1.5; padding: 2px 2px 6px; }
.mp-signin-list { display: flex; flex-direction: column; gap: 4px; }
.mp-signin-row { display: flex; align-items: center; gap: 8px; border: 0; background: transparent; color: inherit; font: inherit; padding: 7px 6px; border-radius: 9px; cursor: pointer; text-align: left; }
.mp-signin-row:hover { background: var(--dsw-alias-bg-layer-2, rgba(16,18,24,.06)); }
.mp-signin-name { flex: 1 1 auto; font-size: 12px; }
.mp-signin-cta { font-size: 11.5px; color: var(--dsw-alias-brand-primary, #4d6bfe); }
.mp-provider-badge { width: 9px; height: 9px; border-radius: 3px; flex: 0 0 auto; display: inline-block; }
.mp-provider-badge.is-lg { width: 30px; height: 30px; border-radius: 9px; }
.mp-spinner { width: 13px; height: 13px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; display: inline-block; animation: mp-spin .7s linear infinite; flex: 0 0 auto; }
@keyframes mp-spin { to { transform: rotate(360deg); } }
.mp-modal-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(10,12,18,.42); display: flex; align-items: center; justify-content: center; padding: 20px; }
.mp-modal { width: 420px; max-width: 100%; background: var(--dsw-alias-bg-overlay, #fff); color: var(--dsw-alias-label-primary, #15171c);
  border: 1px solid var(--dsw-alias-border-l1, rgba(16,18,24,.10)); border-radius: 16px; box-shadow: 0 24px 60px -20px rgba(10,14,24,.55); overflow: hidden; }
.mp-modal-head { display: flex; align-items: center; gap: 9px; padding: 13px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(16,18,24,.08)); }
.mp-modal-title { flex: 1 1 auto; font-size: 13.5px; font-weight: 600; }
.mp-modal-tabs { display: flex; gap: 4px; padding: 10px 14px 0; }
.mp-seg { border: 1px solid transparent; background: transparent; color: var(--dsw-alias-label-secondary, #767b86); font: inherit; font-size: 12px; padding: 5px 12px; border-radius: 999px; cursor: pointer; }
.mp-seg.is-active { color: var(--dsw-alias-label-primary, #15171c); background: var(--dsw-alias-bg-layer-2, rgba(16,18,24,.07)); font-weight: 600; }
.mp-modal-body { padding: 12px 14px 14px; }
.mp-qr-state { display: flex; flex-direction: column; align-items: center; gap: 9px; }
.mp-qr-image { width: 180px; height: 180px; border-radius: 12px; background: #fff; padding: 6px; border: 1px solid var(--dsw-alias-border-l1, rgba(16,18,24,.10)); object-fit: contain; }
.mp-qr-placeholder { display: flex; align-items: center; justify-content: center; color: var(--dsw-alias-label-secondary, #767b86); }
.mp-qr-hint { font-size: 12px; color: var(--dsw-alias-label-secondary, #767b86); }
.mp-qr-hint.is-ok { color: var(--dsw-alias-state-success-primary, #1d9a5b); font-weight: 600; }
.mp-qr-site { font-size: 10.5px; color: var(--dsw-alias-label-secondary, #767b86); opacity: .8; }
.mp-qr-error { color: var(--dsw-alias-state-error-primary, #d33b41); font-size: 12px; }
.mp-cookie-form { display: flex; flex-direction: column; gap: 8px; }
.mp-help { font-size: 11.5px; line-height: 1.6; color: var(--dsw-alias-label-secondary, #767b86); }
.mp-input { width: 100%; font: inherit; font-size: 12px; color: inherit; background: var(--dsw-alias-bg-layer-1, rgba(16,18,24,.04));
  border: 1px solid var(--dsw-alias-border-l1, rgba(16,18,24,.14)); border-radius: 10px; padding: 8px 10px; resize: vertical; }
.mp-input:focus { outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe); outline-offset: -1px; }
.mp-modal-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 2px; }
.mp-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--dsw-alias-border-l1, rgba(16,18,24,.14)); background: var(--dsw-alias-bg-layer-1, rgba(16,18,24,.03));
  color: inherit; font: inherit; font-size: 12px; padding: 6px 13px; border-radius: 9px; cursor: pointer; }
.mp-btn:hover { background: var(--dsw-alias-bg-layer-2, rgba(16,18,24,.07)); }
.mp-btn-primary { background: var(--dsw-alias-brand-primary, #4d6bfe); border-color: transparent; color: #fff; }
.mp-btn-primary:disabled { opacity: .55; cursor: default; }
.mp-btn-ghost { background: transparent; }
.mp-settings { display: flex; flex-direction: column; gap: 10px; max-width: 760px; color: var(--dsw-alias-label-primary, #15171c); }
.mp-settings-title { margin: 0; font-size: 15px; font-weight: 650; }
.mp-settings-intro { margin: 0; font-size: 12.5px; line-height: 1.65; color: var(--dsw-alias-label-secondary, #767b86); }
.mp-cards { display: flex; flex-direction: column; gap: 8px; }
.mp-card { border: 1px solid var(--dsw-alias-border-l1, rgba(16,18,24,.10)); border-radius: 12px; padding: 11px 12px; display: flex; flex-direction: column; gap: 6px; background: var(--dsw-alias-bg-layer-1, rgba(16,18,24,.02)); }
.mp-card-head { display: flex; align-items: center; gap: 10px; }
.mp-card-text { flex: 1 1 auto; min-width: 0; }
.mp-card-title { font-size: 13px; font-weight: 600; }
.mp-card-sub { font-size: 11.5px; color: var(--dsw-alias-label-secondary, #767b86); }
.mp-card-actions { display: flex; gap: 6px; }
.mp-card-note { font-size: 11px; line-height: 1.6; color: var(--dsw-alias-label-secondary, #767b86); }
.mp-card-sites { font-size: 10.5px; color: var(--dsw-alias-label-secondary, #767b86); opacity: .8; }
.mp-settings-block { border: 1px solid var(--dsw-alias-border-l1, rgba(16,18,24,.10)); border-radius: 12px; padding: 12px; max-height: 420px; overflow: auto; }
.mp-settings .mp-track, .mp-settings .mp-playlist { padding: 7px 8px; }
@media (max-width: 720px) {
  .mp-panel { left: 8px; bottom: 56px; width: calc(100vw - 16px); }
}
@media (prefers-reduced-motion: reduce) {
  .mp-panel { animation: none; }
  .mp-spinner { animation-duration: 1.6s; }
}
`

    let styleEl = null

    function installStyles() {
      if (styleEl && styleEl.isConnected) return
      styleEl = document.createElement('style')
      styleEl.setAttribute('data-dsh-music-player', '')
      styleEl.textContent = CSS
      document.head.appendChild(styleEl)
    }

    function removeStyles() {
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl)
      styleEl = null
    }

    /* ================================================================== *
     * Module entry
     * ================================================================== */

    function attachLocale(ctx) {
      const service = ctx.locale
      if (!service) return undefined
      localeService = service
      const disposers = []
      try {
        disposers.push(service.register(NS, 'zh', ZH))
        disposers.push(service.register(NS, 'en', EN))
      } catch {
        /* already registered (hot reload) */
      }
      try {
        if (typeof service.bind === 'function') {
          const bound = service.bind(NS)
          if (typeof bound === 'function') serviceTranslate = bound
        }
      } catch {
        /* keep the local dictionaries */
      }
      try {
        if (typeof service.subscribe === 'function') {
          disposers.push(
            service.subscribe(() => {
              bumpLocale()
            }),
          )
        }
      } catch {
        /* ignore */
      }
      bumpLocale()
      return () => {
        for (const dispose of disposers) {
          try {
            dispose()
          } catch {
            /* ignore */
          }
        }
        if (localeService === service) localeService = null
        serviceTranslate = null
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        installStyles()
        ctx.effect(() => removeStyles, 'music-player: styles')
        ctx.effect(() => attachLocale(ctx), 'music-player: locale')

        // Inside the sidebar footer: the player follows the column (wide or the
        // 56px rail) instead of hovering over the rest of the app.
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register(
            { name: 'sidebar.footer.action', id: 'dsh-music-player', order: 30 },
            MusicFooter,
          ),
        )
        // The expanded panel and the sign-in dialog float in the frame-wide
        // overlay layer, which stacks above every column: a dialog rendered
        // inside the sidebar column would be covered by the conversation.
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            { name: 'shell.overlay', id: 'dsh-music-player-overlay', order: 30 },
            MusicOverlay,
          ),
        )
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'dsh-music-player',
              order: 60,
              label: () => t('settingsTitle'),
            },
            SettingsSection,
          ),
        )
      },
    }
  },
})
