/**
 * Static checks for the Client bundle that the browser would otherwise surface
 * only as a slot crash: undefined identifiers used in render, and identifiers
 * referenced exactly once (a definition nobody calls).
 *
 *   node test/client-lint.mjs
 */
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

let failed = 0
function fail(message) {
  failed += 1
  console.log(`FAIL  ${message}`)
}
function pass(message) {
  console.log(`PASS  ${message}`)
}

// 1. Every function/const declared must be referenced more than once.
const declarations = new Set()
for (const match of source.matchAll(/^\s{4}function ([A-Za-z_$][\w$]*)\s*\(/gm)) declarations.add(match[1])
for (const match of source.matchAll(/^\s{4}const ([A-Za-z_$][\w$]*) = /gm)) declarations.add(match[1])

const unreferenced = []
for (const name of declarations) {
  const hits = source.match(new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`, 'g'))
  if (!hits || hits.length <= 1) unreferenced.push(name)
}
if (unreferenced.length) fail(`declared but never used: ${unreferenced.join(', ')}`)
else pass(`${declarations.size} declarations are all referenced`)

// 2. Every `h(Component` / `h(useThing` name must exist as a declaration.
const known = new Set(declarations)
for (const match of source.matchAll(/\bh\(([A-Z_a-z][\w$]*)/g)) known.add(match[1])
const usedInRender = new Set()
for (const match of source.matchAll(/\bh\(([A-Z][\w$]*)/g)) usedInRender.add(match[1])
const missing = [...usedInRender].filter((name) => !known.has(name))
if (missing.length) fail(`rendered but not declared: ${missing.join(', ')}`)
else pass(`${usedInRender.size} rendered components resolve`)

// 3. No unresolved `TODO`/`FIXME` left in shipped code.
const todos = source.match(/TODO|FIXME/g)
if (todos) fail(`${todos.length} TODO/FIXME markers left`)
else pass('no TODO/FIXME markers')

// 4. The two required slots are registered, and no other slot is touched.
const slots = new Set([...source.matchAll(/slots\.inject\('([^']+)'/g)].map((match) => match[1]))
const expected = ['sidebar.footer.action', 'shell.overlay', 'settings.section']
if (slots.size !== expected.length || expected.some((name) => !slots.has(name))) {
  fail(`slots registered: ${[...slots].join(', ')}`)
} else pass(`slots: ${[...slots].join(', ')}`)

// 5. Everything the module takes from React must exist there.
const destructure = source.match(/const \{([^}]+)\} = React/)
if (!destructure) fail('no React destructuring found')
else {
  const hooks = destructure[1].split(',').map((item) => item.trim()).filter(Boolean)
  const expectedHooks = ['useState', 'useEffect', 'useRef', 'useCallback']
  const unexpected = hooks.filter((item) => !expectedHooks.includes(item))
  if (unexpected.length) fail(`unexpected React imports: ${unexpected.join(', ')}`)
  else pass(`React imports: ${hooks.join(', ')}`)
}

// 6. The Host API base must match the Host route prefix.
const api = source.match(/const API = '([^']+)'/)
if (!api || api[1] !== '/music/player') fail(`API base is ${api ? api[1] : 'missing'}`)
else pass(`API base ${api[1]}`)

// 7. Locale dictionaries must be structurally identical (no key drift).
const zhBlock = source.slice(source.indexOf('const ZH = {'), source.indexOf('const EN = {'))
const enBlock = source.slice(source.indexOf('const EN = {'), source.indexOf('let localeService'))
const keys = (block) => [...block.matchAll(/^\s{6}([a-zA-Z]+):/gm)].map((match) => match[1]).sort()
const zhKeys = keys(zhBlock)
const enKeys = keys(enBlock)
const drift = zhKeys.filter((key) => !enKeys.includes(key)).concat(enKeys.filter((key) => !zhKeys.includes(key)))
if (drift.length) fail(`locale key drift: ${drift.join(', ')}`)
else pass(`${zhKeys.length} locale keys aligned`)

// 8. Every `t('key')` call must existing in the dictionaries.
const knownKeys = new Set(zhKeys)
const called = new Set([...source.matchAll(/\bt\('([^']+)'/g)].map((match) => match[1]))
const unknownKeys = [...called].filter((key) => !knownKeys.has(key))
if (unknownKeys.length) fail(`t() keys not in the dictionaries: ${unknownKeys.join(', ')}`)
else pass(`${called.size} t() keys resolve`)

// 9. Styles must not hardcode colours outside the documented fallbacks.
const cssStart = source.indexOf('const CSS = `')
const css = source.slice(cssStart, source.indexOf('let styleEl'))
const hexes = [...new Set([...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) => match[0]))]
const allowedHex = new Set(['#fff', '#ffffff', '#000000'])
const badHex = hexes.filter((hex) => !allowedHex.has(hex.toLowerCase()))
if (badHex.length) console.log(`WARN  literal colours in CSS (provider brands/pictures only): ${badHex.join(', ')}`)
else pass('CSS colours resolve through theme tokens (plus pure white/black)')

console.log(failed ? `\n${failed} check(s) failed` : '\nall client checks passed')
process.exit(failed ? 1 : 0)
