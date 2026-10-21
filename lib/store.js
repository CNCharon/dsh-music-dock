/**
 * Durable account store.
 *
 * Signing in to a music provider is the expensive part of this plugin, so the
 * provider cookies are kept between sessions. The file lives outside the
 * workspace, in the profile's data directory, with owner-only permissions where
 * the platform supports them; it holds nothing but provider cookies and the
 * account label they resolved to.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'

const DIR_NAME = '.dsh-music-player'
const FILE_NAME = 'accounts.json'

export function storeDir() {
  // The profile directory wins when the Host was launched with one; otherwise
  // fall back to the user's home so the accounts still outlive a restart.
  if (process.env.DSH_PROFILE_DIR) return join(process.env.DSH_PROFILE_DIR, DIR_NAME)
  if (process.env.DSH_HOME) return join(process.env.DSH_HOME, DIR_NAME)
  return join(homedir(), DIR_NAME)
}

function storePath() {
  return join(storeDir(), FILE_NAME)
}

/** Read the stored accounts; a corrupt or missing file is simply empty. */
export function loadAccounts() {
  try {
    const raw = readFileSync(storePath(), 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed
  } catch {
    return {}
  }
}

/** Persist the accounts atomically enough for one process, best effort. */
export function saveAccounts(accounts) {
  try {
    const dir = storeDir()
    mkdirSync(dir, { recursive: true })
    const file = storePath()
    writeFileSync(file, `${JSON.stringify(accounts, null, 2)}\n`, 'utf8')
    try {
      chmodSync(file, 0o600)
    } catch {
      /* Windows has no mode bits; the ACL inherited from the profile applies */
    }
    return true
  } catch {
    return false
  }
}
