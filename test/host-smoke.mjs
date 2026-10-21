/**
 * Host smoke test: exercises the adapters and the QR helpers directly against
 * the live provider APIs, without the Cordis runtime. Run with:
 *   node test/host-smoke.mjs
 * It prints one line per capability and exits non-zero when a required one
 * fails. Network-dependent checks are reported, never fatal, when the host has
 * no route to the provider.
 */
import { MusicService } from '../lib/service.js'
import { neteaseQr } from '../lib/qr.js'

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const service = new MusicService()

record('adapters listed', service.list().length === 2, service.list().map((item) => item.id).join(', '))

const initial = service.states()
record('states default to signed out', initial.every((item) => item.signedIn === false), `${initial.length} providers`)

const unknown = [{ id: '0004jPDk2eB2dt', name: '晴天', artist: '周杰伦' }]

try {
  const audio = await service.audio('qq', unknown[0])
  record('qq audio answers (member-gated is expected)', Boolean(audio), audio && (audio.url ? 'url' : audio.reason))
} catch (error) {
  record('qq audio answers', false, error.message)
}

try {
  const audio = await service.audio('netease', { id: '347230', name: '海阔天空' })
  record('netease audio answers (gated is expected)', Boolean(audio), audio && (audio.url ? 'url' : audio.reason))
} catch (error) {
  record('netease audio answers', false, error.message)
}

try {
  const lyric = await service.lyric('qq', { id: '003OUlho2HcRHC' })
  record('qq lyric parses', /\[\d{1,3}:\d{1,2}/.test(lyric), `${lyric.length} chars`)
} catch (error) {
  record('qq lyric parses', false, error.message)
}

try {
  const lyric = await service.lyric('netease', { id: '509781655' })
  record('netease lyric parses', /\[\d{1,3}:\d{1,2}/.test(lyric), `${lyric.length} chars`)
} catch (error) {
  record('netease lyric parses', false, error.message)
}

try {
  const created = await neteaseQr.create()
  record('netease qr created', Boolean(created.key && created.image), created.image.slice(0, 26))
  const check = await neteaseQr.check(created.key)
  record('netease qr polls', check.state === 'waiting' || check.state === 'scanned', check.state)
} catch (error) {
  record('netease qr created', false, error.message)
}

let failure = 0
const required = new Set(['adapters listed', 'states default to signed out', 'netease qr created', 'qq lyric parses'])
for (const item of results) {
  if (!item.ok && required.has(item.name)) failure += 1
}
console.log(`\n${results.filter((item) => item.ok).length}/${results.length} checks passed`)
process.exit(failure ? 1 : 0)
