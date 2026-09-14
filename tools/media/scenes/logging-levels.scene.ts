import { levelsStage } from '../src/levels/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('logging')

/**
 * One program, one knob, and the output that follows the knob.
 *
 * What this package sells is a dial rather than a feature: the code that logs
 * is written once and how much of it survives is decided at run time by the
 * level. So the frame is a terminal with the level scale drawn across the top
 * of it and the same five lines, one per level, always in the same place
 * underneath. The knob slides from `log` out to `debug`, back to `error`, then
 * to `warn` and home to `log`; each line lights as the knob reaches its stop
 * and ghosts as the knob leaves it, so the level is seen to be the filter and
 * nothing else changes. The chip names the call and carries the level in force,
 * updating as the knob lands.
 *
 * The facts are the package's own, verified on 2026-09-12 against
 * `libs/logging/src/create-log-level-config.ts` (priorities `error` 4, `warn`
 * 3, `log` 2, `info` 1, `debug` 0, and a line printing when its level's
 * priority is at or above the configured level's, which is why the scale runs
 * `error` to `debug` and a knob admits everything to its left) and
 * `libs/logging/src/create-logger.ts` (`setLogLevel` on the logger, a channel
 * prepending `[prefix]`, and a channel of a channel joining with a colon, so
 * `release.channel('npm')` prints `[release:npm]`).
 */
export default defineScriptedScene({
  slug: 'logging-levels',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: levelsStage,
  holdMs: 1_600,
  gif: { colours: 56, lossy: 60, maxBytes: 800_000 },
  stills: [{ name: 'poster', atMs: 3_200, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    title: 'checkout-web',
    api: { name: 'setLogLevel', mark: identity.mark },
    start: 'log',
    restMs: 800,
    lines: [
      { level: 'error', prefix: '[release:npm]', message: '401 Unauthorized: npm token expired' },
      { level: 'warn', prefix: '[release]', message: 'peer dependency unmet: react@19' },
      { level: 'log', prefix: '[release]', message: 'checkout-web 4.2.0 ready to publish' },
      { level: 'info', prefix: '[release:npm]', message: 'publish dry run, 12 files' },
      { level: 'debug', prefix: '[release]', message: 'collect tarball completed in 84ms' },
    ],
    moves: [
      { to: 'debug', atMs: 1_600, durationMs: 600 },
      { to: 'error', atMs: 4_000, durationMs: 900 },
      { to: 'warn', atMs: 6_500, durationMs: 600 },
      { to: 'log', atMs: 8_600, durationMs: 600 },
    ],
  },
})
