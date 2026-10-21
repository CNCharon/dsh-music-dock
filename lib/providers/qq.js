/**
 * QQ Music adapter.
 *
 * Login transports a `y.qq.com` cookie: either the one the QR flow (`qr.js`)
 * exchanged from `ptlogin2`, or one pasted from a signed-in browser. Both are
 * QQ-side tickets (`uin` + `p_skey`/`pt_oauth_token`), which the web endpoints
 * used here accept; a QQ Music ticket (`qm_keyst`) is also understood.
 *
 * The library is the union of two APIs: `fcg_user_created_diss` for created
 * playlists, and `fcg_get_profile_order_asset` for the favourites — "我喜欢的
 * 音乐" (`reqtype=1`, paged) and collected playlists (`reqtype=3`). Created
 * diss rows are flat, favourites rows wrap the song as `{ songtype, data }`.
 *
 * Playback is resolved through `vkey.GetVkeyServer`; `result: 104003` means the
 * track is members-only, which is reported instead of silently failing.
 */
import { cookieHeader, request } from '../http.js'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const REFERER = { Referer: 'https://y.qq.com/portal/profile.html', Origin: 'https://y.qq.com' }
const GUID = '10000'

function headers(session, extra = {}) {
  return {
    'User-Agent': UA,
    ...REFERER,
    ...(session && session.cookie ? { Cookie: cookieHeader(session.cookie) } : {}),
    ...extra,
  }
}

/** QQ answers `text/javascript` for most endpoints; the body is JSON anyway. */
function body(response) {
  if (!response.json || typeof response.json !== 'object') {
    throw new Error(`QQ 音乐返回了非 JSON 响应（HTTP ${response.status}）`)
  }
  return response.json
}

/**
 * `g_tk` is the 5381-seeded DJB2 hash of the session ticket (`p_skey`/`skey`).
 * The favourite-collecting endpoints validate it; the music-side key is the
 * fallback when the session only carries `qm_keyst`.
 */
function gTk(cookie) {
  const key = (cookie && (cookie.p_skey || cookie.skey || cookie.qqmusic_key || cookie.qm_keyst)) || ''
  let hash = 5381
  for (let index = 0; index < key.length; index += 1) {
    hash += (hash << 5) + key.charCodeAt(index)
    hash &= 0x7fffffff
  }
  return hash & 0x7fffffff
}

/** The cookie value may be the `o0123…` form; every API param wants digits. */
function uinDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function qs(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('&')
}

export const qq = {
  id: 'qq',
  name: 'QQ 音乐',

  async login(session, credentials) {
    const mode = credentials && credentials.mode
    let cookie
    if (mode === 'cookie') cookie = parseCookie(credentials.cookie)
    else if (mode === 'password') cookie = parseCookie(credentials.cookie)
    else throw new Error('不支持的登录方式')

    if (!cookie.uin && cookie.wxuin) cookie.uin = cookie.wxuin
    if (cookie.uin) cookie.uin = String(cookie.uin).trim()
    if (!cookie.uin) throw new Error('Cookie 里没有 uin，请确认复制的是已登录状态的完整 Cookie')
    if (!cookie.qm_keyst && !cookie.qqmusic_key && !cookie.p_skey && !cookie.pt_oauth_token) {
      throw new Error('Cookie 里没有 qm_keyst / qqmusic_key / p_skey，请从已登录的 y.qq.com 复制完整 Cookie')
    }
    return { cookie }
  },

  async check(session) {
    const rawUin = session && session.cookie && session.cookie.uin
    const uin = uinDigits(rawUin)
    if (!uin) return null

    // The user-info module is the only endpoint with an unambiguous verdict:
    // 500003/860100001 means "not signed in", anything else with data is a
    // live session. A private profile (code 4000 elsewhere) is still signed in.
    const probe = {
      req_0: { module: 'music.UserInfo.userInfo', method: 'GetUserInfo', param: {} },
    }
    const payload = body(
      await request(
        `https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=${encodeURIComponent(JSON.stringify(probe))}`,
        { headers: headers(session, { Referer: 'https://y.qq.com/' }) },
      ),
    )
    const info = (payload && payload.req_0) || {}
    const hasSession = Boolean(session.cookie && (session.cookie.p_skey || session.cookie.pt_oauth_token))
    if (info.code === 500003 || info.subcode === 860100001) {
      // Not signed in at all — unless the ticket chain produced a QQ session,
      // which many of the provider's calls accept as-is.
      if (!hasSession) return null
    }

    if (info.code === 0 && info.data) {
      const data = info.data
      const nick =
        (data.nick && (data.nick.name || data.nick)) ||
        data.nickname ||
        (data.basic && (data.basic.nick || data.basic.name)) ||
        ''
      return { uid: uin, name: String(nick || `QQ ${uin}`), avatar: undefined }
    }

    // Fall back to the public profile page: privacy (4000) is not a sign-out.
    const created = body(
      await request(
        `https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss?${qs({
          hostuin: uin,
          sin: 0,
          size: 1,
          format: 'json',
          inCharset: 'utf8',
          outCharset: 'utf-8',
          platform: 'yqq.json',
          needNewCode: 0,
          g_tk: 5381,
        })}`,
        { headers: headers(session) },
      ),
    )
    if (created.code === 1000) return null
    const data = created.data || {}
    return { uid: uin, name: String(data.hostname || `QQ ${uin}`), avatar: undefined }
  },

  async playlists(session, account) {
    const uin = uinDigits(account.uid)
    const cookie = session.cookie || {}
    // Both playlist endpoints validate `g_tk` and share the public `yqq.json`
    // parameter set. The favourite endpoint additionally only answers for "my
    // own" data when `loginUin`/`hostUin` name the signed-in account.
    const common = {
      g_tk: gTk(cookie),
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: 0,
      platform: 'yqq.json',
      needNewCode: 0,
      loginUin: uin,
    }
    const notes = []
    let createdList = []
    let collectedList = []
    let liked = null

    try {
      const created = body(
        await request(
          `https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss?${qs({
            ...common,
            hostuin: uin,
            sin: 0,
            size: 500,
          })}`,
          { headers: headers(session) },
        ),
      )
      createdList = (created.data && created.data.disslist) || []
    } catch (error) {
      notes.push(`创建歌单接口失败：${error && error.message ? error.message : String(error)}`)
    }

    // "我喜欢的音乐" is not a diss, so it never appears in the created list. It
    // lives behind `reqtype=1` of the favourites endpoint; one row is enough to
    // learn the total, and `tracks` pages through the rest.
    try {
      const favourite = body(
        await request(favouriteUrl(cookie, uin, { reqtype: 1, sin: 0, ein: 1 }), { headers: headers(session) }),
      )
      const total = Number((favourite.data && favourite.data.totalsong) || 0)
      if (total > 0) {
        liked = {
          id: LIKED_ID,
          name: '我喜欢的音乐',
          cover: undefined,
          count: total,
          created: false,
          special: true,
        }
      }
    } catch (error) {
      notes.push(`我喜欢的音乐接口失败：${error && error.message ? error.message : String(error)}`)
    }

    try {
      const collected = body(
        await request(favouriteUrl(cookie, uin, { reqtype: 3, sin: 0, ein: 500 }), { headers: headers(session) }),
      )
      collectedList = (collected.data && collected.data.cdlist) || []
      // code 0 with an empty list simply means "no collected playlists"; only a
      // non-zero code is an error worth surfacing.
      if (collected.code !== 0 && collected.code != null) {
        notes.push(`收藏歌单接口返回 code=${collected.code}${collected.msg ? `（${collected.msg}）` : ''}`)
      }
    } catch (error) {
      notes.push(`收藏歌单接口失败：${error && error.message ? error.message : String(error)}`)
    }

    const result = []
    for (const item of createdList) {
      const dirid = Number(item.dirid || 0)
      const raw = item.tid ?? item.disstid ?? item.dissid
      // `tid` is the diss id. The legacy "QZone背景音乐" folder reports 0, which
      // a truthiness test would drop silently; keep it under a `dir:` id so a
      // playlist is never lost to a falsy id.
      const id = raw != null && raw !== '' && Number(raw) > 0 ? String(raw) : dirid ? `${DIR_PREFIX}${dirid}` : ''
      if (!id) continue
      result.push({
        id,
        name: String(item.diss_name || item.dissname || item.name || '未命名歌单'),
        cover: item.diss_cover ? String(item.diss_cover) : undefined,
        count: Number(item.song_cnt || item.songnum || item.cnt || 0),
        created: true,
        // dirid 201 is QQ's own "我喜欢" list.
        special: Number(item.dirid) === 201,
      })
    }
    // Liked songs belong to the "collected" group, above the collected diss.
    if (liked) result.push(liked)
    for (const item of collectedList) {
      const id = String(item.dissid || item.tid || '')
      if (!id) continue
      result.push({
        id,
        name: String(item.dissname || item.diss_name || '未命名歌单'),
        cover: item.logo ? String(item.logo) : item.diss_cover ? String(item.diss_cover) : undefined,
        count: Number(item.song_cnt || item.songnum || 0),
        created: false,
        special: false,
      })
    }
    // Arrays can carry a note; the service copies it into the account state so
    // the page can explain a partial sync instead of hiding it.
    if (notes.length) result.warning = notes.join('；')
    return result
  },

  async tracks(session, playlistId, account) {
    if (playlistId === LIKED_ID) return likedTracks(session, account)
    if (String(playlistId).startsWith(DIR_PREFIX)) return dirTracks(session, String(playlistId).slice(DIR_PREFIX.length))
    return dissTracks(session, playlistId, account)
  },

  async lyric(session, track) {
    const payload = body(
      await request(
        `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?${qs({
          songmid: track.id,
          format: 'json',
          nobase64: 1,
          g_tk: 5381,
        })}`,
        { headers: headers(session, { Referer: 'https://y.qq.com/' }) },
      ),
    )
    const lyric = payload.lyric || payload.retcode === 0 ? payload.lyric : ''
    return decodeEntities(lyric || '')
  },

  async audio(session, track) {
    const cookie = (session && session.cookie) || {}
    // `musicu` wants the numeric account, not the `o123…` cookie spelling.
    const uin = uinDigits(cookie.uin || cookie.p_uin || '') || '0'
    const payload = {
      comm: { uin, format: 'json', ct: 24, cv: 4747474 },
      req_0: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: {
          guid: GUID,
          songmid: [track.id],
          songtype: [0],
          uin,
          loginflag: 1,
          platform: '20',
        },
      },
    }
    const response = body(
      await request(`https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=${encodeURIComponent(JSON.stringify(payload))}`, {
        headers: headers(session, { Referer: 'https://y.qq.com/' }),
      }),
    )
    const data = (response.req_0 && response.req_0.data) || response.req || {}
    const info = (data.midurlinfo && data.midurlinfo[0]) || {}
    if (info.purl) {
      const sip = (data.sip && data.sip[0]) || 'https://dl.stream.qqmusic.qq.com/'
      return { url: `${sip}${info.purl}` }
    }
    const result = Number(info.result || 0)
    if (result === 104003) {
      // A VIP account whose `qm_keyst` never reached the session looks exactly
      // like a non-member: the vkey server treats it as anonymous.
      const hasMusicKey = Boolean(cookie.qm_keyst || cookie.qqmusic_key)
      return {
        url: '',
        reason: hasMusicKey
          ? '需要 QQ 音乐会员：当前账号没有这首曲目的播放权益'
          : 'QQ 音乐没有认可这次登录（缺少音乐凭据 qm_keyst），会员权益无法生效；请退出后重新扫码登录',
      }
    }
    return { url: '', reason: `QQ 音乐没有返回播放地址（result ${result || '未知'}）` }
  },
}

/** Synthetic ids: QQ's favourite list and legacy `dir` folders have no diss id. */
const LIKED_ID = 'liked'
const DIR_PREFIX = 'dir:'

/**
 * The favourites endpoint (`fcg_get_profile_order_asset`) serves liked songs
 * (`reqtype=1`) and collected playlists (`reqtype=3`). It validates `g_tk` and
 * ignores a request for "my" data unless `loginUin`/`hostUin` are the account.
 */
function favouriteUrl(cookie, uin, extra) {
  return `https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg?${qs({
    g_tk: gTk(cookie),
    ct: 20,
    cid: 205360956,
    userid: uin,
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: 0,
    platform: 'yqq.json',
    needNewCode: 0,
    loginUin: uin,
    hostUin: uin,
    ...extra,
  })}`
}

function uinOf(session, account) {
  return uinDigits((account && account.uid) || (session.cookie && session.cookie.uin))
}

/**
 * Liked songs come back as `{ songtype, data }` wrappers, one page per request
 * (`sin` is the start offset, `ein` the exclusive end). Page until the server
 * stops reporting more rows.
 */
async function likedTracks(session, account) {
  const uin = uinOf(session, account)
  const pageSize = 500
  const tracks = []
  for (let start = 0; ; ) {
    const payload = body(
      await request(favouriteUrl(session.cookie || {}, uin, { reqtype: 1, sin: start, ein: start + pageSize }), {
        headers: headers(session),
      }),
    )
    const data = payload.data || {}
    const page = data.songlist || []
    for (const item of page) {
      const track = trackOf(item)
      if (track) tracks.push(track)
    }
    if (!page.length || !Number(data.has_more) || tracks.length >= 20000) break
    start += page.length
  }
  return tracks
}

/** A normal diss, addressed by its `disstid`. */
async function dissTracks(session, playlistId, account) {
  const uin = uinOf(session, account)
  const payload = body(
    await request(
      `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?${qs({
        type: 1,
        json: 1,
        utf8: 1,
        onlysong: 0,
        disstid: playlistId,
        format: 'json',
        g_tk: 5381,
        uin,
        loginUin: uin,
        hostUin: 0,
        platform: 'yqq.json',
        needNewCode: 0,
      })}`,
      { headers: headers(session) },
    ),
  )
  return songListOf(payload).map(trackOf).filter(Boolean)
}

/**
 * Legacy `dir` folders (the QZone background-music folder is dirid 205) are not
 * diss. They are readable through the same detail call with `disstid=0` plus a
 * `dirid`, but only for a session that also carries QQ Music's own ticket, so an
 * empty answer is explained instead of pretending the folder has no songs.
 */
async function dirTracks(session, dirid) {
  const uin = uinOf(session, {})
  const payload = body(
    await request(
      `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?${qs({
        type: 1,
        json: 1,
        utf8: 1,
        onlysong: 0,
        disstid: 0,
        dirid,
        format: 'json',
        g_tk: 5381,
        uin,
        loginUin: uin,
        hostUin: 0,
        platform: 'yqq.json',
        needNewCode: 0,
      })}`,
      { headers: headers(session) },
    ),
  )
  const tracks = songListOf(payload).map(trackOf).filter(Boolean)
  if (!tracks.length) {
    throw new Error(`QQ 音乐没有返回这个歌单（dirid ${dirid}）的曲目：这类 QQ 空间歌单需要 qm_keyst 凭据，网页 Cookie 登录读不到`)
  }
  return tracks
}

function songListOf(payload) {
  return (payload.cdlist && payload.cdlist[0] && payload.cdlist[0].songlist) || []
}

/**
 * Normalise a track row. `fcg_ucc_getcdinfo_byids_cp` returns flat rows, while
 * the favourites endpoint wraps each one as `{ songtype, data }`; both spell the
 * album as `albummid`/`albumname` rather than as an `album` object.
 *
 * `vip` is true when playback itself is paid/member-only (`pay.payplay`), which
 * is exactly the row the dock marks red. `pay.paydownload` is a different right
 * (download) and must not tint an ordinary streamable track.
 */
function trackOf(raw) {
  const song = raw && raw.data ? raw.data : raw
  if (!song || typeof song !== 'object') return null
  const id = String(song.songmid || song.mid || '')
  if (!id) return null
  const albumMid = String(song.albummid || (song.album && song.album.mid) || '')
  return {
    id,
    name: String(song.songname || song.name || song.title || ''),
    artist: (song.singer || [])
      .map((singer) => (singer && singer.name) || '')
      .filter(Boolean)
      .join(' / '),
    album: String(song.albumname || (song.album && (song.album.name || song.album.title)) || ''),
    cover: albumMid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg` : undefined,
    duration: Number(song.interval || 0) * 1000,
    vip: Number(song.pay && (song.pay.payplay || 0)) === 1,
  }
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

function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
