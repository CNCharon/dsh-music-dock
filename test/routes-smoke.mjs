/**
 * Route-level test: boots the real handler over a throwaway HTTP server, with a
 * stub webServer/logger, and checks the browser-facing contract (JSON envelope,
 * same-origin guard, and that every provider is honestly reported).
 *
 *   node test/routes-smoke.mjs
 */
import { createServer } from 'node:http'
import { MusicService } from '../lib/service.js'
import { createRouteHandler } from '../lib/routes.js'

const logs = []
const service = new MusicService({ log: (message) => logs.push(message) })
const handler = createRouteHandler({}, service)

const server = createServer((req, res) => {
  if (!req.url.startsWith('/music/player')) {
    res.writeHead(404).end()
    return
  }
  handler(req, res)
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

let failed = 0
async function check(name, fn) {
  try {
    const detail = await fn()
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } catch (error) {
    failed += 1
    console.log(`FAIL  ${name} — ${error.message}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function get(path) {
  const response = await fetch(`${base}${path}`)
  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = undefined
  }
  return { status: response.status, json, text, headers: response.headers }
}

async function post(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, json: JSON.parse(text) }
}

await check('state answers the two providers', async () => {
  const response = await get('/music/player/state')
  assert(response.status === 200, `status ${response.status}`)
  assert(response.json.ok === true, 'ok flag missing')
  assert(response.json.value.length === 2, `got ${response.json.value.length}`)
  assert(
    response.json.value.every((item) => item.signedIn === false),
    'a fresh service must report every provider signed out',
  )
  return response.json.value.map((item) => item.id).join(', ')
})

await check('adapters endpoint lists names', async () => {
  const response = await get('/music/player/adapters')
  assert(response.json.ok === true, 'ok flag missing')
  assert(response.json.value.every((item) => item.id !== 'kugou'), 'kugou must be gone')
  assert(response.json.value.every((item) => item.mode === 'account'), 'both providers are account providers')
  return response.json.value.map((item) => item.name).join(', ')
})

await check('hydrate answers', async () => {
  const response = await get('/music/player/hydrate')
  assert(response.json.ok === true, 'ok flag missing')
  return `${response.json.value.length} providers`
})

await check('unknown action is a 404 envelope', async () => {
  const response = await get('/music/player/nope')
  assert(response.status === 404, `status ${response.status}`)
  assert(response.json.ok === false && typeof response.json.error === 'string', 'error envelope missing')
  return response.json.error
})

await check('missing provider is rejected', async () => {
  const response = await post('/music/player/sync', {})
  assert(response.status === 400, `status ${response.status}`)
  assert(/provider/.test(response.json.error), response.json.error)
  return response.json.error
})

await check('signed-out sync is rejected', async () => {
  const response = await post('/music/player/sync', { provider: 'qq' })
  assert(response.status === 400, `status ${response.status}`)
  assert(/登录/.test(response.json.error), response.json.error)
  return response.json.error
})

await check('a cookieless sign-in is rejected with a reason', async () => {
  const response = await post('/music/player/sign-in', { provider: 'netease', credentials: { mode: 'cookie', cookie: '' } })
  assert(response.status === 400, `status ${response.status}`)
  assert(/MUSIC_U/.test(response.json.error), response.json.error)
  return response.json.error
})

await check('cross-origin requests are refused', async () => {
  const response = await fetch(`${base}/music/player/state`, { headers: { origin: 'https://evil.example' } })
  assert(response.status === 403, `status ${response.status}`)
  return 'origin guard'
})

await check('netease qr key is created', async () => {
  const response = await get('/music/player/login/qr/create?provider=netease')
  assert(response.json.ok === true, response.json.error || 'ok flag missing')
  assert(response.json.value.image.startsWith('data:image/svg+xml;base64,'), 'qr image missing')
  const poll = await get(`/music/player/login/qr/check?provider=netease&key=${encodeURIComponent(response.json.value.key)}`)
  assert(poll.json.ok === true, poll.json.error || 'poll failed')
  assert(['waiting', 'scanned', 'expired'].includes(poll.json.value.state), poll.json.value.state)
  return `state=${poll.json.value.state}`
})

await check('qq qr ticket picture is created', async () => {
  const response = await get('/music/player/login/qr/create?provider=qq')
  assert(response.json.ok === true, response.json.error || 'ok flag missing')
  assert(response.json.value.image.startsWith('data:image/png;base64,'), 'qr png missing')
  assert(Buffer.from(response.json.value.image.split(',')[1], 'base64').length > 200, 'qr png too small')
  const poll = await get(`/music/player/login/qr/check?provider=qq&key=${encodeURIComponent(response.json.value.key)}`)
  assert(poll.json.ok === true, poll.json.error || 'poll failed')
  assert(['waiting', 'scanned', 'expired', 'failed'].includes(poll.json.value.state), poll.json.value.state)
  return `png=${Buffer.from(response.json.value.image.split(',')[1], 'base64').length}B state=${poll.json.value.state}`
})

await check('an unknown provider is refused for sign-in', async () => {
  const response = await post('/music/player/sign-in', {
    provider: 'kugou',
    credentials: { mode: 'cookie', cookie: 'userid=1; token=x' },
  })
  assert(response.status === 400, `status ${response.status}`)
  assert(/未知的音乐平台/.test(response.json.error), response.json.error)
  return response.json.error
})

await check('stream refuses an unplayable track without a body', async () => {
  const response = await get('/music/player/stream?provider=qq&id=0004jPDk2eB2dt&name=x')
  assert(response.status === 404, `status ${response.status}`)
  assert(response.json.ok === false, 'error envelope missing')
  return response.json.error
})

console.log(`\n${logs.length} host log line(s): ${logs.slice(0, 4).join(' | ') || '(none)'}`)
server.close()
process.exit(failed ? 1 : 0)
