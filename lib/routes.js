/**
 * The plugin's same-origin HTTP surface.
 *
 * One prefix route, `/music/player/...`, so the browser half has a stable base
 * URL and the provider cookies never leave the Host:
 *
 *   GET  /music/player/state
 *   GET  /music/player/adapters
 *   GET  /music/player/login/qr/create?provider=
 *   GET  /music/player/login/qr/check?provider=&key=
 *   POST /music/player/sign-in   { provider, credentials }
 *   POST /music/player/sign-out  { provider }
 *   POST /music/player/sync      { provider }
 *   POST /music/player/tracks    { provider, playlistId }
 *   POST /music/player/lyric     { provider, track }
 *   POST /music/player/audio     { provider, track }
 *   GET  /music/player/stream?provider=&id=&...
 *
 * `stream` resolves the provider URL and pipes the bytes through this origin:
 * the CDNs used by QQ Music and NetEase Cloud Music neither send CORS headers
 * nor accept the `Range` request a browser media element issues directly.
 */
import { QR_ADAPTERS } from './qr.js'
import { checkForUpdate } from './update.js'

const MAX_BODY = 1024 * 1024

const FORWARD_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function json(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function trackFromQuery(query) {
  const id = query.get('id') || ''
  if (!id) throw new Error('缺少 id')
  return {
    id,
    name: query.get('name') || '',
    artist: query.get('artist') || '',
    album: query.get('album') || '',
    duration: Number(query.get('duration') || 0),
  }
}

/** Minimal refusal for requests that do not come from this app's own page. */
function sameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    const host = req.headers.host
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function createRouteHandler(ctx, service) {
  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const action = url.pathname.slice('/music/player'.length).replace(/^\/+|\/+$/g, '')

    try {
      if (!sameOrigin(req)) {
        json(res, 403, { ok: false, error: '只接受同源请求' })
        return
      }

      if (req.method === 'GET') {
        if (action === 'state') {
          json(res, 200, { ok: true, value: service.states() })
          return
        }
        if (action === 'update') {
          // `dsh plugin` forwards to pnpm, so an installed copy never learns
          // about a newer tag by itself; the settings page asks here.
          json(res, 200, { ok: true, value: await checkForUpdate() })
          return
        }
        if (action === 'hydrate') {
          // The page opens once; this rebuilds every restored account's library
          // in the background so the dock shows playlists without a manual sync.
          const provider = url.searchParams.get('provider') || ''
          if (provider) await service.ensureSynced(provider)
          else await Promise.all(service.states().map((item) => service.ensureSynced(item.id)))
          json(res, 200, { ok: true, value: service.states() })
          return
        }
        if (action === 'adapters') {
          json(res, 200, { ok: true, value: service.list() })
          return
        }
        if (action === 'login/qr/create') {
          const provider = url.searchParams.get('provider') || ''
          const adapter = QR_ADAPTERS[provider]
          if (!adapter) throw new Error(`${provider || '该平台'} 不支持扫码登录`)
          json(res, 200, { ok: true, value: await adapter.create() })
          return
        }
        if (action === 'login/qr/check') {
          const provider = url.searchParams.get('provider') || ''
          const adapter = QR_ADAPTERS[provider]
          if (!adapter) throw new Error(`${provider || '该平台'} 不支持扫码登录`)
          const result = await adapter.check(url.searchParams.get('key') || '')
          if (result.state === 'confirmed' && result.cookie) {
            // The QR exchange already produced the provider cookie, so the
            // account is completed here instead of bouncing back to the page.
            try {
              const account = await service.signInWithCookie(provider, result.cookie)
              json(res, 200, { ok: true, value: { state: 'confirmed', account } })
            } catch (error) {
              json(res, 200, {
                ok: true,
                value: { state: 'failed', message: error && error.message ? error.message : String(error) },
              })
            }
            return
          }
          json(res, 200, { ok: true, value: { state: result.state, message: result.message } })
          return
        }
        if (action === 'stream') {
          const provider = url.searchParams.get('provider') || ''
          const track = trackFromQuery(url.searchParams)
          const resolved = await service.audio(provider, track)
          if (!resolved || !resolved.url) {
            json(res, 404, { ok: false, error: (resolved && resolved.reason) || '平台没有返回播放地址' })
            return
          }
          await pipeAudio(req, res, resolved.url)
          return
        }
        json(res, 404, { ok: false, error: `未知的操作：${action || '/'}` })
        return
      }

      if (req.method === 'POST') {
        const payload = await readJson(req)
        const provider = payload.provider
        if (!provider) throw new Error('缺少 provider')

        if (action === 'sign-in') {
          json(res, 200, { ok: true, value: await service.signIn(provider, payload.credentials || {}) })
          return
        }
        if (action === 'sign-out') {
          json(res, 200, { ok: true, value: service.signOut(provider) })
          return
        }
        if (action === 'sync') {
          json(res, 200, { ok: true, value: await service.sync(provider) })
          return
        }
        if (action === 'tracks') {
          if (!payload.playlistId) throw new Error('缺少 playlistId')
          json(res, 200, { ok: true, value: await service.tracks(provider, String(payload.playlistId)) })
          return
        }
        if (action === 'lyric') {
          const track = payload.track || {}
          if (!track.id) throw new Error('缺少 track.id')
          json(res, 200, { ok: true, value: await service.lyric(provider, track) })
          return
        }
        if (action === 'audio') {
          const track = payload.track || {}
          if (!track.id) throw new Error('缺少 track.id')
          json(res, 200, { ok: true, value: await service.audio(provider, track) })
          return
        }
        json(res, 404, { ok: false, error: `未知的操作：${action || '/'}` })
        return
      }

      json(res, 405, { ok: false, error: '不支持的方法' })
    } catch (error) {
      const message = error && error.message ? error.message : String(error)
      try {
        service.log(`route ${action || '/'}: ${message}`)
      } catch {
        /* logging must not mask the failure */
      }
      if (!res.headersSent) json(res, 400, { ok: false, error: message })
      else {
        try {
          res.end()
        } catch {
          /* ignore */
        }
      }
    }
  }
}

/**
 * Stream a provider URL through this origin, forwarding `Range` so the browser
 * can seek without downloading the whole track.
 */
async function pipeAudio(req, res, url) {
  const headers = {
    'User-Agent': FORWARD_UA,
    Referer: 'https://y.qq.com/',
    Accept: '*/*',
  }
  if (req.headers.range) headers.Range = req.headers.range

  const upstream = await fetch(url, { headers, redirect: 'follow' })
  if (!upstream.ok && upstream.status !== 206) {
    json(res, 502, { ok: false, error: `音频源返回 HTTP ${upstream.status}` })
    return
  }

  const out = {
    'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  }
  const passthrough = {
    'content-length': 'Content-Length',
    'content-range': 'Content-Range',
    etag: 'ETag',
    'last-modified': 'Last-Modified',
  }
  for (const [name, target] of Object.entries(passthrough)) {
    const value = upstream.headers.get(name)
    if (value) out[target] = value
  }
  res.writeHead(upstream.status, out)

  if (!upstream.body || req.method === 'HEAD') {
    res.end()
    return
  }
  const reader = upstream.body.getReader()
  let closed = false
  res.on('close', () => {
    closed = true
    reader.cancel().catch(() => {})
  })
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done || closed) break
      if (!res.write(Buffer.from(value))) {
        await new Promise((resolve) => res.once('drain', resolve))
      }
    }
  } catch {
    // The client hung up mid-track.
  } finally {
    if (!closed) {
      try {
        res.end()
      } catch {
        /* ignore */
      }
    }
  }
}
