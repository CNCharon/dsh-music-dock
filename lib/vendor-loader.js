/** Host-side loader for the vendored QR encoder (a classic script, not a module). */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

let cached = null

export function qrFactory() {
  if (cached) return cached
  const source = readFileSync(fileURLToPath(new URL('./vendor/qrcode.js', import.meta.url)), 'utf8')
  const sandbox = {}
  // The vendored build assigns its factory to `window.qrcode`.
  cached = new Function('window', `${source}\nreturn window.qrcode`)(sandbox)
  return cached
}
