/**
 * QR sign-in.
 *
 * NetEase: `unikey` from `interface.music.163.com` (desktop protocol, type=3,
 * bare form POST) → the user scans `music.163.com/login?codekey=...` →
 * `qrcode/client/login` answers 800/801/802/803 and, on 803, hands over the
 * `MUSIC_U` cookie. The older `music.163.com` + `type=1` endpoint still answers
 * 801 but never observes the phone's confirmation. The picture is drawn on the
 * Host from that URL because the image the page renders is a canvas the Host
 * cannot read.
 *
 * QQ: the real `ptlogin2.qq.com` ticket flow, same as the QQ Music web player:
 * `ptqrshow` mints a picture plus a `qrsig` cookie, `ptqrlogin` polls it
 * (66 waiting / 67 scanned / 68 expired / 0 done), and the 0 branch's ticket is
 * traded for an OAuth code (check_sig → oauth2/authorize) which `QQLogin`
 * exchanges for `musickey` (= the `qm_keyst` cookie). That key is what makes the
 * music APIs treat the session as a signed-in account (and a VIP's membership
 * audible); the QQ-side `p_skey` alone only reaches the library endpoints.
 * Everything runs on the Host so the cookie jar never reaches page scripts.
 *
 * Kugou has no QR path at all: its login is bound to the app's registered
 * device, so it was removed from this plugin together with the provider.
 */
import { qrFactory } from './vendor-loader.js'
import { postForm, request, requestBinary } from './http.js'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** Render a URL as a `data:image/svg+xml` QR picture. */
export function qrDataUrl(text, cellSize = 5, margin = 8) {
  const QRCode = qrFactory()
  const qr = QRCode(0, 'M')
  qr.addData(text)
  qr.make()
  const count = qr.getModuleCount()
  const size = count * cellSize + margin * 2
  const rects = []
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (!qr.isDark(row, column)) continue
      rects.push(
        `<rect x="${margin + column * cellSize}" y="${margin + row * cellSize}" width="${cellSize}" height="${cellSize}"/>`,
      )
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#ffffff"/><g fill="#000000">${rects.join('')}</g></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

function collectCookies(setCookie, into) {
  for (const line of setCookie || []) {
    const pair = String(line).split(';')[0]
    const at = pair.indexOf('=')
    if (at > 0) {
      const name = pair.slice(0, at).trim()
      const value = pair.slice(at + 1).trim()
      // An empty value is a *deletion* (the response also re-clears names it
      // sets elsewhere). Skipping it keeps the real value from being wiped.
      if (!value) continue
      // `into` is a plain object for one-shot exchanges and a Map for the QQ
      // ticket sessions, which need `get`/`set` semantics per picture.
      if (typeof into.set === 'function') into.set(name, value)
      else into[name] = value
    }
  }
  return into
}

function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
}

/** QQ's `g_tk`/`ptqrtoken` hash: DJB2 seeded with 5381, masked to 31 bits. */
function hash33(value, seed = 5381) {
  let hash = seed
  for (let index = 0; index < value.length; index += 1) hash += (hash << 5) + value.charCodeAt(index)
  return hash & 0x7fffffff
}

function queryString(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('&')
}

/**
 * Turn the QQ ticket into a QQ Music session.
 *
 * The scan only authorises the QQ side. The value the music APIs actually need
 * is `musickey` (the `qm_keyst` cookie), and it is reached in three steps the
 * web player performs after a scan:
 *
 *   check_sig          → mints `p_skey` for the ticket
 *   oauth2/authorize   → trades `p_skey` for an OAuth `code`
 *   QQConnectLogin     → trades `code` for `musickey`
 *
 * Exchanging `p_skey` directly (the previous attempt) is rejected with
 * code 1000/104400; only the `code` handshake yields the music key, which is
 * what makes membership (VIP) audible.
 */
async function exchangeQqCode(jar, uin, sigx, trace) {
  const checkSig = await request(
    `https://ssl.ptlogin2.graph.qq.com/check_sig?${queryString({
      uin,
      pttype: '1',
      service: 'ptqrlogin',
      nodirect: '0',
      ptsigx: sigx,
      s_url: 'https://graph.qq.com/oauth2.0/login_jump',
      ptlang: '2052',
      ptredirect: '100',
      aid: '716027609',
      daid: '383',
      j_later: '0',
      low_login_hour: '0',
      regmaster: '0',
      pt_login_type: '3',
      pt_aid: '0',
      pt_aaid: '16',
      pt_light: '0',
      pt_3rd_aid: '100497308',
    })}`,
    {
      headers: { 'User-Agent': UA, Referer: 'https://xui.ptlogin2.qq.com/', Cookie: cookieHeader(jar) },
      redirect: 'manual',
    },
  )
  collectCookies(checkSig.setCookie, jar)
  const pSkey = jar.get('p_skey')
  if (!pSkey) throw new Error(`check_sig 未下发 p_skey（HTTP ${checkSig.status}）`)
  trace.push('check_sig → p_skey')

  const authorize = await postForm(
    'https://graph.qq.com/oauth2.0/authorize',
    new URLSearchParams({
      response_type: 'code',
      client_id: '100497308',
      redirect_uri: 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/',
      scope: 'get_user_info,get_app_friends',
      state: 'state',
      switch: '',
      from_ptlogin: '1',
      src: '1',
      update_auth: '1',
      openapi: '1010_1030',
      g_tk: String(hash33(pSkey)),
      auth_time: String(Date.now()),
      ui: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    }),
    {
      headers: { 'User-Agent': UA, Referer: 'https://graph.qq.com/', Cookie: cookieHeader(jar) },
      redirect: 'manual',
    },
  )
  collectCookies(authorize.setCookie, jar)
  const location = authorize.headers.location || ''
  const codeMatch = location.match(/[?&]code=([^&]+)/)
  if (!codeMatch) throw new Error(`oauth2/authorize 未返回 code（HTTP ${authorize.status}）`)
  trace.push('oauth2/authorize → code')

  const payload = {
    comm: { tmeLoginType: 2 },
    req1: {
      module: 'QQConnectLogin.LoginServer',
      method: 'QQLogin',
      param: { code: decodeURIComponent(codeMatch[1]) },
    },
  }
  const response = await request(
    `https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=${encodeURIComponent(JSON.stringify(payload))}`,
    { headers: { 'User-Agent': UA, Referer: 'https://y.qq.com/', Cookie: cookieHeader(jar) } },
  )
  collectCookies(response.setCookie, jar)
  const req1 = response.json && response.json.req1
  const data = (req1 && req1.data) || {}
  if (!data.musickey) {
    const errtip = (req1 && req1.data && req1.data.errtip) || ''
    throw new Error(`QQLogin 未返回音乐凭据（code=${(req1 && req1.code) || '?'}${errtip ? ` ${errtip}` : ''}）`)
  }
  trace.push('QQLogin → musickey')
  return data
}

/**
 * NetEase QR must go through `interface.music.163.com` with the desktop
 * protocol (`type=3`, bare form POST). The older
 * `music.163.com/api/login/qrcode/...` + `type=1` combination still answers
 * 801, but it no longer observes the phone's confirmation — which looks exactly
 * like "authorised on the phone, then nothing happens".
 */
const NETEASE_QR_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) NeteaseMusicDesktop/3.0.18.203152 Chrome/91.0.4472.164 Electron/13.6.9 Safari/537.36'

const NETEASE_QR = 'https://interface.music.163.com/api/login/qrcode'

/** Per-key cookie jar: anything the flow sets must ride the next poll. */
const neteaseQrSessions = new Map()

function neteaseQrSession(key) {
  if (!neteaseQrSessions.has(key)) {
    neteaseQrSessions.set(key, new Map())
    while (neteaseQrSessions.size > 8) neteaseQrSessions.delete(neteaseQrSessions.keys().next().value)
  }
  return neteaseQrSessions.get(key)
}

function neteaseQrHeaders(jar) {
  const headers = { 'User-Agent': NETEASE_QR_UA, Referer: 'https://music.163.com/' }
  if (jar && jar.size) headers.Cookie = cookieHeader(jar)
  return headers
}

/** `MUSIC_U=…; __csrf=…` as returned inside the 803 body. */
function cookieObject(raw) {
  const out = {}
  for (const part of String(raw || '').split(';')) {
    const at = part.indexOf('=')
    if (at <= 0) continue
    out[part.slice(0, at).trim()] = part.slice(at + 1).trim()
  }
  return out
}

export const neteaseQr = {
  async create() {
    const response = await postForm(`${NETEASE_QR}/unikey`, new URLSearchParams({ type: '3' }), {
      headers: { 'User-Agent': NETEASE_QR_UA, Referer: 'https://music.163.com/' },
    })
    const payload = response.json || {}
    if (payload.code !== 200 || !payload.unikey) throw new Error('网易云没有返回二维码 key')
    const key = String(payload.unikey)
    collectCookies(response.setCookie, neteaseQrSession(key))
    const url = `https://music.163.com/login?codekey=${encodeURIComponent(key)}`
    return { key, url, image: qrDataUrl(url) }
  },

  async check(key) {
    const jar = neteaseQrSessions.get(key)
    const response = await postForm(`${NETEASE_QR}/client/login`, new URLSearchParams({ key, type: '3' }), {
      headers: neteaseQrHeaders(jar),
      redirect: 'manual',
    })
    if (jar) collectCookies(response.setCookie, jar)

    const payload = response.json || {}
    const cookie = {}
    if (jar) for (const [name, value] of jar) cookie[name] = value
    collectCookies(response.setCookie, cookie)
    // A confirmed poll carries the session as a `cookie` header string in the
    // body; the headers may also carry it on the 302 hop.
    if (typeof payload.cookie === 'string') Object.assign(cookie, cookieObject(payload.cookie))
    else if (payload.cookie && typeof payload.cookie === 'object') Object.assign(cookie, payload.cookie)

    if (payload.code === 803 || cookie.MUSIC_U || cookie.MUSIC_A) {
      if (!cookie.MUSIC_U && !cookie.MUSIC_A) throw new Error('扫码成功但网易云没有下发登录 Cookie')
      neteaseQrSessions.delete(key)
      return { state: 'confirmed', cookie }
    }
    if (payload.code === 800) {
      neteaseQrSessions.delete(key)
      return { state: 'expired' }
    }
    if (payload.code === 801) return { state: 'waiting' }
    if (payload.code === 802) return { state: 'scanned' }
    return { state: 'waiting', message: payload.message }
  },
}

/** `ptqrtoken` is a 32-bit hash of the `qrsig` cookie the picture came with. */
function ptqrtoken(qrsig) {
  let hash = 0
  for (let index = 0; index < qrsig.length; index += 1) {
    hash += (hash << 5) + qrsig.charCodeAt(index)
  }
  return hash & 0x7fffffff
}

/**
 * Follow redirects by hand so every hop's Set-Cookie lands in the jar. Every
 * hop is appended to `trace` (when given) so a failed exchange can show exactly
 * where the chain stopped instead of leaving a blank result.
 */
async function followWithJar(url, jar, limit = 8, trace) {
  let current = url
  for (let hop = 0; hop < limit; hop += 1) {
    let response
    try {
      response = await request(current, {
        redirect: 'manual',
        headers: { 'User-Agent': UA, Referer: 'https://y.qq.com/', Cookie: cookieHeader(jar) },
      })
    } catch (error) {
      if (trace) trace.push(`hop${hop + 1} 请求失败: ${error && error.message ? error.message : String(error)}`)
      return null
    }
    const names =
      (response.setCookie || [])
        .map((line) => {
          const text = String(line).split(';')[0]
          const at = text.indexOf('=')
          return at > 0 ? `${text.slice(0, at).trim()}(${text.slice(at + 1).trim().length})` : text
        })
        .join('+') || '-'
    collectCookies(response.setCookie, jar)
    const location = response.headers && response.headers.location
    if (trace) {
      trace.push(`hop${hop + 1} ${response.status} ${new URL(current).host} set-cookie=${names}`)
    }
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(unescapeJs(location), current).toString()
      continue
    }
    return response
  }
  return null
}

/**
 * The OAuth bridge pages finish the login with a client-side redirect
 * (`location.href='…'`, a meta refresh, or a ptuiCB callback) instead of a 3xx.
 * Landing on one and stopping means the authorization code never reaches
 * y.qq.com, so the chain has to follow what the page says.
 */
function pageRedirect(html) {
  const text = String(html || '')
  const patterns = [
    /location\.(?:href\s*=|replace\(|assign\()['"]?(https?:[^'"]+)['"]?\)?/i,
    /location\s*=\s*['"](https?:[^'"]+)['"]/i,
    /url\s*[:=]\s*['"](https?:[^'"]+)['"]/i,
    /content\s*=\s*['"][^'"]*url=(https?:[^'"]+)['"]/i,
    /ptuiCB\('[^']*','[^']*','(https?:[^']+)'/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) return unescapeJs(match[1].trim())
  }
  return ''
}

/** ptuiCB quotes URLs with \x26-style escapes; the server needs real &. */
function unescapeJs(text) {
  return String(text || '').replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
}

/**
 * QQ QR sessions, kept per picture: the `qrsig` cookie is the picture's ticket
 * and must ride every poll for that picture. Oldest entries are evicted so a
 * few abandoned dialogs cannot grow the map.
 */
const qqSessions = new Map()

function qqSession(key) {
  if (!qqSessions.has(key)) {
    qqSessions.set(key, { jar: new Map(), checked: 0 })
    while (qqSessions.size > 8) {
      const oldest = qqSessions.keys().next().value
      qqSessions.delete(oldest)
    }
  }
  return qqSessions.get(key)
}

/**
 * Trade the QQ-side `p_skey` for the music key (`qm_keyst`) — the call the QQ
 * Music web player makes right after a scan confirms.
 */
async function exchangeMusicKey(jar, cookie, musickey, shape = 'QQLogin') {
  const digits = String(cookie.uin || '').replace(/\D/g, '')
  // `musicid` is a number here — a string gets req1.code=10006 and no key.
  const musicid = Number(digits)
  const param =
    shape === 'Login'
      ? { uin: musicid, musickey, platform: '20' }
      : { expired_in: 7776000, musicid, musickey }
  const payload = {
    comm: { uin: digits, cv: 4747474, ct: 24, format: 'json', platform: 'yqq.json' },
    req1: {
      module: shape === 'Login' ? 'music.login.LoginServer' : 'QQConnectLogin.LoginServer',
      method: shape === 'Login' ? 'Login' : 'QQLogin',
      param,
    },
  }
  const response = await request(
    `https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=${encodeURIComponent(JSON.stringify(payload))}`,
    {
      headers: {
        'User-Agent': UA,
        Referer: 'https://y.qq.com/',
        Cookie: cookieHeader(jar),
      },
    },
  )
  collectCookies(response.setCookie, jar)
  const req1 = response.json && response.json.req1
  const data = req1 && req1.data
  const key = (data && (data.musickey || data.music_key)) || (req1 && req1.musickey) || ''
  return {
    key,
    code: (req1 && req1.code) || 0,
    raw: JSON.stringify(req1 || response.json || {}).slice(0, 180),
  }
}

/** Follow one URL to its final response (3xx hops included). */
async function lastOfChain(url, jar, trace) {
  if (!url) return null
  const response = await followWithJar(url, jar, 8, trace)
  return response
}

export const qqQr = {
  async create() {
    const jar = new Map()
    // Warm the jar with the web player's own cookies first — `ptqrlogin` 403s
    // without a prior `y.qq.com` / `xui.ptlogin2.qq.com` visit in this session.
    await followWithJar('https://y.qq.com/', jar, 3)
    await followWithJar('https://xui.ptlogin2.qq.com/cgi-bin/xlogin?daid=383&pt_3rd_aid=100497308&hide_title_bar=1&low_login=0&pt_uistyle=40&style=12&lang=2052&appid=716027609', jar, 3)

    // The ticket picture is a PNG; `request` would decode it as UTF-8 and
    // corrupt it, so this one hop reads bytes.
    const picture = await requestBinary(
      `https://ssl.ptlogin2.qq.com/ptqrshow?appid=716027609&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}&daid=383&pt_3rd_aid=100497308`,
      { headers: { 'User-Agent': UA, Referer: 'https://xui.ptlogin2.qq.com/', Cookie: cookieHeader(jar) } },
    )
    const bytes = picture.bytes || Buffer.alloc(0)
    collectCookies(picture.setCookie, jar)
    const qrsig = jar.get('qrsig')
    if (!qrsig) throw new Error('QQ 登录服务没有返回二维码凭据')
    if (bytes.length < 200) throw new Error('QQ 登录服务没有返回二维码图片')

    const key = `qq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    qqSessions.set(key, { jar, checked: 0 })
    while (qqSessions.size > 8) {
      const oldest = qqSessions.keys().next().value
      qqSessions.delete(oldest)
    }
    return {
      key,
      url: 'https://y.qq.com/',
      image: `data:image/png;base64,${bytes.toString('base64')}`,
    }
  },

  async check(key) {
    const session = qqSessions.get(key)
    if (!session) return { state: 'expired' }
    const { jar } = session
    session.checked += 1

    const response = await request(
      'https://ssl.ptlogin2.qq.com/ptqrlogin?' +
        `u1=${encodeURIComponent('https://graph.qq.com/oauth2.0/login_jump')}` +
        `&ptqrtoken=${ptqrtoken(jar.get('qrsig') || '')}` +
        '&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052' +
        `&action=0-0-${Date.now()}&js_ver=22082316&js_type=1&login_sig=` +
        '&pt_uistyle=40&aid=716027609&daid=383&pt_3rd_aid=100497308&has_onekey=1&',
      {
        headers: {
          'User-Agent': UA,
          Referer: 'https://xui.ptlogin2.qq.com/',
          Origin: 'https://xui.ptlogin2.qq.com',
          Cookie: cookieHeader(jar),
        },
      },
    )
    collectCookies(response.setCookie, jar)

    const text = String(response.text || '')
    const args = [...text.matchAll(/'([^']*)'/g)].map((match) => match[1])
    const code = args[0]

    if (code === '66') return { state: 'waiting' }
    if (code === '67') return { state: 'scanned' }
    if (code === '68') {
      qqSessions.delete(key)
      return { state: 'expired' }
    }
    if (code !== '0') return { state: 'waiting' }
    // The ticket link is one-shot: claim the session before following it so a
    // second poll of the same picture can never consume it twice.
    if (session.confirming) return { state: 'scanned' }
    session.confirming = true

    // Scan confirmed. The music key is not on the ticket jump: trade the ticket
    // for an OAuth code first (check_sig → authorize → QQLogin), which is what
    // yields `musickey` (= qm_keyst) and with it membership playback.
    const trace = []
    const jump = unescapeJs(args[2])
    const uinMatch = jump.match(/[?&]uin=([^&]+)/)
    const sigxMatch = jump.match(/[?&]ptsigx=([^&]+)/)

    let granted = null
    if (uinMatch && sigxMatch) {
      try {
        granted = await exchangeQqCode(jar, uinMatch[1], sigxMatch[1], trace)
      } catch (error) {
        trace.push(`授权码交换失败：${error && error.message ? error.message : String(error)}`)
      }
    } else {
      trace.push('登录跳转里没有 uin/ptsigx，跳过授权码交换')
    }

    // The ticket jump is one-shot, so it is only followed when the code
    // handshake failed: it still seeds the QQ-side cookies the library endpoints
    // accept, just without the music key.
    if (!granted) {
      try {
        let landed = await lastOfChain(jump, jar, trace)
        for (let hop = 0; hop < 3; hop += 1) {
          const next = landed && pageRedirect(landed.text)
          if (!next) break
          trace.push(`页面跳转 → ${new URL(next).host}`)
          landed = await lastOfChain(next, jar, trace)
        }
        await followWithJar('https://y.qq.com/', jar, 3, trace)
      } catch (error) {
        trace.push(`票据跳转失败：${error && error.message ? error.message : String(error)}`)
      }
    }

    const cookie = {}
    for (const name of ['uin', 'p_uin', 'wxuin', 'p_skey', 'skey', 'qm_keyst', 'qqmusic_key', 'pt_oauth_token', 'p_skey_forbid', 'pt_login_type', 'pt2gguin', 'psrf_qqaccess_token', 'psrf_qqopenid', 'psrf_access_token_expiresAt', 'psrf_musickey', 'psrf_qqunionid', 'pt4_token']) {
      const value = jar.get(name)
      if (value) cookie[name] = value
    }
    if (!cookie.uin && cookie.wxuin) cookie.uin = cookie.wxuin
    // Newer ticket chains only set `p_uin`; it carries the same account number.
    if (!cookie.uin && cookie.p_uin) cookie.uin = cookie.p_uin

    if (granted) {
      cookie.qm_keyst = String(granted.musickey)
      cookie.qqmusic_key = String(granted.musickey)
      const musicid = granted.str_musicid || granted.musicid
      if (musicid) cookie.uin = String(musicid)
    }

    // Last resort for sessions that only expose a QQ-side token: try the
    // documented `musickey` exchange with those tokens. It is rejected for
    // graph.qq.com tickets, but a pasted session may carry a usable one.
    if (!cookie.qm_keyst && !cookie.qqmusic_key && cookie.uin) {
      const attempts = [
        { shape: 'QQLogin', tokens: ['pt_oauth_token', 'p_skey', 'skey'] },
        { shape: 'Login', tokens: ['pt_oauth_token', 'p_skey', 'skey'] },
      ]
      outer: for (const attempt of attempts) {
        for (const tokenName of attempt.tokens) {
          const token = cookie[tokenName]
          if (!token) continue
          const exchanged = await exchangeMusicKey(jar, cookie, token, attempt.shape)
          if (exchanged && exchanged.key) {
            cookie.qm_keyst = exchanged.key
            cookie.qqmusic_key = exchanged.key
            trace.push(`凭据交换成功（${attempt.shape}+${tokenName}）`)
            break outer
          }
          trace.push(`交换被拒（${attempt.shape}+${tokenName} → code=${exchanged ? exchanged.code : '异常'} ${exchanged && exchanged.raw ? exchanged.raw : ''}）`)
        }
      }
    }

    // `qm_keyst` is the music-side key, but plenty of the provider's calls
    // accept the QQ-side `p_skey` session directly. Signing in must not hinge
    // on the exchange alone — the library sync reports what the account can
    // actually reach.
    const hasSession = cookie.qm_keyst || cookie.qqmusic_key || cookie.p_skey || cookie.pt_oauth_token
    if (!cookie.uin || !hasSession) {
      // The ticket is spent either way; drop the session so the next try is clean.
      qqSessions.delete(key)
      const names = Object.keys(cookie).filter((name) => cookie[name]).join(', ') || '(none)'
      const tokens = ['pt_oauth_token', 'p_skey', 'skey', 'pt4_token']
        .map((name) => `${name}(${cookie[name] ? String(cookie[name]).length : 0})`)
        .join(' ')
      return {
        state: 'failed',
        message:
          '扫码确认成功，但没有换到音乐登录凭据（qm_keyst）。\n' +
          '已收集到的 Cookie：' + names + '\n' +
          '候选凭据：' + tokens + '\n' +
          '跳转轨迹：' + (trace.join(' → ') || '(无)') + '\n' +
          '请重新扫码；如果仍然失败，可改用 Cookie 登录（Cookie 需含 qm_keyst）。',
      }
    }
    qqSessions.delete(key)
    return { state: 'confirmed', cookie }
  },
}

export const QR_ADAPTERS = { netease: neteaseQr, qq: qqQr }
