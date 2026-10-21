/**
 * Update check.
 *
 * Users install this plugin from GitHub (`dsh plugin --profile web add
 * github:CNCharon/dsh-music-dock`), and `dsh plugin` forwards to pnpm — there is
 * no `update` subcommand that would move them to a newer tag. So the manual
 * upgrade path is a second `add`, and the only way a user learns about it is if
 * the plugin says so itself.
 *
 * The check compares this package's version with the newest GitHub release (or
 * tag) and returns an absolute URL plus the exact command to run. Failures are
 * silent: an offline host, a rate limit, or a repo without releases must not
 * turn into noise in the settings page.
 */
import { readFileSync } from 'node:fs'

const REPO = 'CNCharon/dsh-music-dock'
const CACHE_MS = 30 * 60 * 1000
const TIMEOUT_MS = 6000

let cached = null

/** This package's version, read once from its own package.json. */
function currentVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    return String(pkg.version || '')
  } catch {
    return ''
  }
}

/** `1.2.3` → [1,2,3]; anything unparseable → null. */
function parseVersion(value) {
  const match = String(value || '').match(/(\d+)\.(\d+)\.(\d+)/)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

function isNewer(latest, current) {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  if (!a || !b) return false
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index]
  }
  return false
}

async function github(path) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`https://api.github.com${path}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'dsh-music-dock-update-check',
        Accept: 'application/vnd.github+json',
      },
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @returns {Promise<{current: string, latest: string, available: boolean,
 *   url: string, command: string}>}
 */
export async function checkForUpdate() {
  const current = currentVersion()
  if (cached && Date.now() - cached.at < CACHE_MS) return { ...cached.value, current }

  let latest = ''
  let url = `https://github.com/${REPO}`

  const release = await github(`/repos/${REPO}/releases/latest`)
  if (release && release.tag_name) {
    latest = String(release.tag_name).replace(/^v/i, '')
    url = release.html_url || url
  } else {
    const tags = await github(`/repos/${REPO}/tags?per_page=20`)
    if (Array.isArray(tags) && tags.length) {
      const versions = tags
        .map((tag) => String(tag.name || '').replace(/^v/i, ''))
        .filter((name) => parseVersion(name))
        .sort((a, b) => (isNewer(a, b) ? -1 : 1))
      if (versions.length) latest = versions[0]
    }
  }

  const value = {
    latest,
    available: Boolean(latest) && isNewer(latest, current),
    url,
    command: `dsh plugin --profile web add github:${REPO}`,
  }
  // Only a real answer is worth remembering: caching "no release found" would
  // pin an offline or rate-limited moment for the next half hour.
  if (latest) cached = { at: Date.now(), value }
  return { current, ...value }
}

/** Test seam: drop the cached answer. */
export function resetUpdateCache() {
  cached = null
}
