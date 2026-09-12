import { defineScriptedScene } from '../src/scene/define-scene'
import { terminalStage } from '../src/terminal/stage'
import { packageIdentity } from './lib/identity'

/**
 * The two commands a feature app runs on its way to production.
 *
 * `hf build` turns the app into a shell package a host can install, and
 * `hf serve` hosts the app's built site. Both are one process doing one
 * thing, and the terminal shows exactly what each prints and nothing more.
 *
 * Verified against `libs/features/src/cli/commands/build.ts` on 2026-09-12:
 * the output directory defaults to `dist/<name>-shell`, the one line printed
 * is `Built "<name>" → <out>` followed by `Packed <tarball>` when `npm pack`
 * ran, and the tarball is named by the generated package, `<name>-shell`.
 * And against `libs/features/src/cli/commands/serve.ts` and
 * `libs/features/src/server/static-serve.ts`: one static server on one root,
 * port 4284 by default, announced as `<root> → <url>` with a trailing slash,
 * and one access-log line per request shaped `<method> <path> <status>`,
 * logging on by default.
 */
export default defineScriptedScene({
  slug: 'hf-serve',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: packageIdentity('features').hue,
  stage: terminalStage,
  holdMs: 1_600,
  gif: { colours: 64, lossy: 60, maxBytes: 1_200_000 },
  stills: [{ name: 'poster', atMs: 8_600, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    title: 'checkout',
    prompt: '~/checkout',
    script: [
      { step: 'pause', ms: 600 },
      { step: 'type', text: 'npx hf build --protocol v4' },
      { step: 'run', thinkMs: 1_100 },
      {
        step: 'output',
        lineMs: 320,
        lines: [
          { text: 'Built "checkout" → /home/dev/checkout/dist/checkout-shell', tone: 'success' },
          { text: 'Packed checkout-shell-1.4.0.tgz', tone: 'plain' },
        ],
      },
      { step: 'pause', ms: 1_100 },
      { step: 'type', text: 'npx hf serve --root dist' },
      { step: 'run', thinkMs: 520 },
      {
        step: 'output',
        lineMs: 260,
        lines: [{ text: '  /home/dev/checkout/dist → http://localhost:4284/', tone: 'accent' }],
        running: true,
      },
      { step: 'pause', ms: 900 },
      {
        step: 'output',
        lineMs: 420,
        lines: [
          { text: 'GET / 200', tone: 'muted' },
          { text: 'GET /assets/index-9f2c41.js 200', tone: 'muted' },
          { text: 'GET /assets/index-3b1d.css 200', tone: 'muted' },
        ],
        running: true,
      },
      { step: 'pause', ms: 1_400 },
    ],
  },
})
