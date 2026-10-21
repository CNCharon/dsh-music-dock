/** Host half of the music player bundle: one prefix route over the player service. */
import { MusicService } from './lib/service.js'
import { createRouteHandler } from './lib/routes.js'

/** The HTTP carrier is required — without it the browser half has no API. */
export const inject = ['webServer']

const PLUGIN = 'music-player'

/** `ctx.logger` may be a logger or a logger factory; never let logging throw. */
function makeLogger(ctx) {
  let logger = null
  try {
    logger = typeof ctx.logger === 'function' ? ctx.logger(PLUGIN) : ctx.logger
  } catch {
    logger = null
  }
  return (message) => {
    try {
      if (logger && typeof logger.info === 'function') logger.info(`[${PLUGIN}] ${message}`)
      else if (logger && typeof logger.warn === 'function') logger.warn(`[${PLUGIN}] ${message}`)
    } catch {
      /* logging must never mask the real failure */
    }
  }
}

export function apply(ctx) {
  const log = makeLogger(ctx)
  const service = new MusicService({ log })
  const handler = createRouteHandler(ctx, service)
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/music/player', handler }), 'music-player: routes')
  const restored = service.states().filter((item) => item.signedIn).length
  log(`mounted /music/player${restored ? `, ${restored} restored account(s)` : ''}`)
}
