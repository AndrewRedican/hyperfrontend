import { defineScriptedScene } from '../src/scene/define-scene'
import { terminalStage } from '../src/terminal/stage'

/**
 * One program, three runs, three different amounts of output.
 *
 * What this package sells is a dial rather than a feature: the code that emits
 * is written once and how much of it survives is decided at run time, so the
 * only honest way to show it is to run the same file more than once and let the
 * scrollback do the arguing. The session opens by reading the first four lines
 * of the script, because everything printed afterwards is explained by them:
 * the level comes from the environment with a fallback the viewer can see, and
 * the two channels are declared where their prefixes can be traced back to.
 *
 * The formats are the package's own. A channel prepends `[prefix]` as its own
 * leading argument, and a channel of a channel joins with a colon, which is why
 * `release.channel('npm')` prints `[release:npm]`. `timed` and `timedAsync`
 * emit `<label> completed in <n>ms` at debug on success and `<label> failed
 * after <n>ms: <message>` at error on failure, the message being the thrown
 * `Error`'s own. Everything else on screen belongs to the invented release
 * script, because the package has no opinion about what you log.
 *
 * The levels behave as the priority table says rather than as the name order
 * suggests: `log` sits above `info` and `debug`, so a run at `log` keeps the
 * error, the warning and the log line and drops the rest. That is the point of
 * the third run being bare. The failure still prints, with the elapsed
 * milliseconds it took to fail, at the setting that printed one line a moment
 * earlier; what the quiet level costs is the stack dump, which `timedAsync`
 * sends to debug and which is therefore absent here.
 *
 * Verified against `libs/logging/src/create-log-level-config.ts` (the six level
 * names, the priority table that puts `log` above `info`, and the `error`
 * default this script overrides), `libs/logging/src/create-logger.ts` (the
 * `[prefix]` tag, the colon join for nested channels, both timing messages and
 * the debug-level stack dump), `libs/logging/src/create-logger.spec.ts` (the
 * emitted call shapes, including `debug('[build]', 'compute completed in Nms')`
 * and the suppression of `info` and `debug` at level `log`) and
 * `libs/logging/src/logger.ts` (the exported `logger` wired to console).
 */
export default defineScriptedScene({
  slug: 'logging-levels',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'docs-wide',
  stage: terminalStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 70, maxBytes: 1_000_000 },
  stills: [{ name: 'poster', atMs: 11_200, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    theme: 'midnight',
    title: 'checkout-web',
    prompt: '~/checkout',
    cps: 34,
    script: [
      { step: 'pause', ms: 450 },
      { step: 'type', text: 'head -4 release.mjs' },
      { step: 'run', thinkMs: 240 },
      {
        step: 'output',
        lineMs: 120,
        lines: [
          { text: "import { logger } from '@hyperfrontend/logging'", tone: 'muted' },
          { text: "logger.setLogLevel(process.env.LOG_LEVEL ?? 'log')", tone: 'muted' },
          { text: "const release = logger.channel('release')", tone: 'muted' },
          { text: "const npm = release.channel('npm')", tone: 'muted' },
        ],
      },
      { step: 'pause', ms: 800 },
      { step: 'type', text: 'node release.mjs --dry-run' },
      { step: 'run', thinkMs: 620 },
      {
        step: 'output',
        lineMs: 180,
        lines: [{ text: '[release] checkout-web 4.2.0 ready to publish', tone: 'plain' }],
      },
      { step: 'pause', ms: 1_100 },
      { step: 'type', text: 'LOG_LEVEL=debug node release.mjs --dry-run' },
      { step: 'run', thinkMs: 560 },
      {
        step: 'output',
        lineMs: 300,
        lines: [
          { text: '[release] collect tarball completed in 84ms', tone: 'accent' },
          { text: '[release:npm] publish completed in 1443ms', tone: 'accent' },
          { text: '[release] checkout-web 4.2.0 ready to publish', tone: 'plain' },
        ],
      },
      { step: 'pause', ms: 1_300 },
      { step: 'type', text: 'node release.mjs' },
      { step: 'run', thinkMs: 880 },
      {
        step: 'output',
        lineMs: 260,
        lines: [{ text: '[release:npm] publish failed after 1904ms: 401 Unauthorized: npm token expired', tone: 'danger' }],
      },
      { step: 'pause', ms: 1_250 },
    ],
  },
})
