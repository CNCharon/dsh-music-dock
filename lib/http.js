/**
 * Shared HTTP helpers for the provider adapters.
 *
 * Each helper returns `{ status, headers, json?, text, setCookie }` so an
 * adapter never has to care whether the provider answered JSON or text (the
 * music providers are inconsistent about `Content-Type`).
 */
const TIMEOUT_MS = 15000

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export function cookieHeader(cookie) {
  if (!cookie) return ''
  return Object.entries(cookie)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

async function send(url, init) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(url, { ...init, signal: controller.signal, redirect: init.redirect || 'follow' })
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('上游接口超时，请稍后重试')
    throw new Error(`无法访问上游接口：${error && error.message ? error.message : String(error)}`)
  } finally {
    clearTimeout(timer)
  }
  const text = await response.text()
  const headers = {}
  response.headers.forEach((value, name) => {
    headers[name] = value
  })
  const setCookie = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = undefined
  }
  return { status: response.status, headers, json, text, setCookie }
}

export function request(url, init = {}) {
  return send(url, {
    method: 'GET',
    ...init,
    headers: { 'User-Agent': DEFAULT_UA, ...(init.headers || {}) },
  })
}

export function postForm(url, body, init = {}) {
  return send(url, {
    ...init,
    method: 'POST',
    body: typeof body === 'string' ? body : body.toString(),
    headers: {
      'User-Agent': DEFAULT_UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(init.headers || {}),
    },
  })
}

export function postJson(url, body, init = {}) {
  return send(url, {
    ...init,
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'User-Agent': DEFAULT_UA,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

/**
 * Fetch bytes instead of text — `send` decodes the body as UTF-8, which would
 * corrupt a binary response such as a provider's QR picture.
 */
export async function requestBinary(url, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(url, { ...init, signal: controller.signal, redirect: init.redirect || 'follow' })
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('上游接口超时，请稍后重试')
    throw new Error(`无法访问上游接口：${error && error.message ? error.message : String(error)}`)
  } finally {
    clearTimeout(timer)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  const setCookie = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  return { status: response.status, bytes, setCookie, headers: response.headers }
}

/** Pull a value out of a `Set-Cookie` list. */
export function findCookie(setCookie, name) {
  for (const line of setCookie || []) {
    const pair = String(line).split(';')[0]
    const at = pair.indexOf('=')
    if (at > 0 && pair.slice(0, at).trim() === name) return pair.slice(at + 1).trim()
  }
  return undefined
}
