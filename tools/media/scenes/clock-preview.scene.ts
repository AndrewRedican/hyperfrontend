import { defineBrowserScene } from '../src/scene/define-scene'

export default defineBrowserScene({
  slug: 'clock-preview',
  asset: 'preview',
  // why: the docs-site gallery wants one frozen frame of the demo, not an animation
  outputs: ['still'],

  // why: 640 square is twice the widest card the still is shown in, and square because
  // why: both the landing stage and the gallery card are aspect-square
  viewport: { width: 640, height: 640 },

  serve: {
    // why: hf serve sends the production COOP/COEP/CSP headers a plain static server does not,
    // why: so the frame is captured under the conditions the embed actually runs in
    cwd: 'apps/demos/clock',
    command: ['npx', 'hf', 'serve', '--root', '{root}', '--port', '{port}'],
    root: 'dist/apps/demos/clock/app',
    readyTimeoutMs: 120_000,
  },

  page: { path: '/' },

  determinism: {
    // why: the dial renders the wall clock, so without pinning the preview is a different
    // why: image on every run; resume keeps time moving so the coin still settles its transform
    clock: { time: '2026-01-01T10:09:30Z', resume: true },
    navigator: { hardwareConcurrency: 4, deviceMemory: 8 },
  },

  ready: { selector: '.coin-scene', timeoutMs: 60_000 },

  assert: { maxConsoleErrors: 0 },

  // why: no animation is kept, so the window is only long enough for the coin to come to rest
  record: { settleMs: 2_500, durationMs: 0 },

  stills: [
    {
      name: 'preview',
      atMs: 0,
      // why: the feature paints no background of its own, and the card's own gradient is what
      // why: shows through the live iframe; capturing the browser's white would bake in a
      // why: colour the demo never draws and make the swap to live a visible flash
      omitBackground: true,
      format: 'webp',
      quality: 82,
      width: 640,
      maxBytes: 60_000,
    },
  ],
})
