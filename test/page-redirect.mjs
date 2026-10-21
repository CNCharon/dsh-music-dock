import fs from 'node:fs'

const s = fs.readFileSync('E:/DeepSeek Harness/default-workspace/dsh-music-dock/lib/qr.js', 'utf8')
const un = s.match(/function unescapeJs\(text\) \{[\s\S]*?\n\}/)
const pr = s.match(/function pageRedirect\(html\) \{[\s\S]*?\n\}/)
if (!un || !pr) throw new Error('helpers not found')
const pageRedirect = new Function(`${un[0]}\n${pr[0]}\nreturn pageRedirect`)()

const cases = [
  ['location.href single quotes', `<script>location.href='https://y.qq.com/qqmusic/?code=ABC123#/';</script>`,
    'https://y.qq.com/qqmusic/?code=ABC123#/'],
  ['location.replace double quotes', `<script>location.replace("https://y.qq.com/?code=XYZ")</script>`,
    'https://y.qq.com/?code=XYZ'],
  ['location = assign', `<script>location='https://y.qq.com/portal/profile.html?code=Q1'</script>`,
    'https://y.qq.com/portal/profile.html?code=Q1'],
  ['meta refresh', `<meta http-equiv="refresh" content="0; url=https://y.qq.com/?code=M1">`,
    'https://y.qq.com/?code=M1'],
  ['ptuiCB with x26 escapes', `ptuiCB('0','0','https://y.qq.com/a?code=1\\x26state=2','0','ok','')`,
    'https://y.qq.com/a?code=1&state=2'],
  ['url: form', `var jumpUrl = 'https://graph.qq.com/jump?code=JJ';`,
    'https://graph.qq.com/jump?code=JJ'],
  ['no redirect', `<html><body>done</body></html>`, ''],
]

let failed = 0
for (const [name, html, expected] of cases) {
  const got = pageRedirect(html)
  const ok = got === expected
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(expected)}`}`)
}
console.log(failed ? `${failed} failed` : 'all page-redirect cases pass')
process.exit(failed ? 1 : 0)
