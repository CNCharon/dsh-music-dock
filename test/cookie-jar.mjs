import fs from 'node:fs'

// Pull the real collectCookies out of qr.js and run it on the exact shape the
// ticket chain sends: a real value followed by a same-name deletion.
const s = fs.readFileSync('E:/DeepSeek Harness/default-workspace/dsh-music-player/lib/qr.js', 'utf8')
const body = s.match(/function collectCookies\(setCookie, into\) \{[\s\S]*?\n\}/)
if (!body) throw new Error('collectCookies not found')
const collectCookies = new Function(`${body[0]}; return collectCookies`)()

const setCookie = [
  'pt2gguin=o0123456789;Path=/;Domain=ptlogin2.qq.com',
  'p_uin=o0123456789;Path=/;Domain=ptlogin2.qq.com',
  'p_skey=AbCdEfGh123456;Path=/;Domain=ptlogin2.qq.com',
  'p_uin=;Path=/;Domain=ptlogin2.qq.com;Max-Age=0', // deletion, same name
  'p_skey=;Path=/;Domain=graph.qq.com;Max-Age=0', // deletion, same name
  'pt4_token=TOKENVALUE;Path=/;Domain=ptlogin2.qq.com',
]

const jar = new Map()
collectCookies(setCookie, jar)

const cookie = {}
for (const name of ['uin', 'p_uin', 'p_skey', 'pt4_token']) {
  const value = jar.get(name)
  if (value) cookie[name] = value
}
if (!cookie.uin && cookie.p_uin) cookie.uin = cookie.p_uin

console.log('jar entries :', [...jar].map(([k, v]) => `${k}=${v}`).join(' | '))
console.log('assembled   :', JSON.stringify(cookie))

const ok = cookie.uin === 'o0123456789' && cookie.p_skey === 'AbCdEfGh123456' && cookie.pt4_token === 'TOKENVALUE'
console.log(ok ? 'PASS: deletions no longer wipe real values, p_uin feeds uin' : 'FAIL')
process.exit(ok ? 0 : 1)
