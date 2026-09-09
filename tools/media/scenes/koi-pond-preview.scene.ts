import { defineBrowserScene } from '../src/scene/define-scene'

export default defineBrowserScene({
  slug: 'koi-pond-preview',
  asset: 'preview',
  outputs: ['still'],

  // why: square like the card it stands in for. The shoal is sized from the viewport's
  // why: geometric mean, so a square this size seats a smaller shoal than the 16:9 hero
  // why: scene does, which is the honest picture of what the square card will show.
  viewport: { width: 640, height: 640 },

  serve: {
    cwd: 'apps/demos/koi-pond/host',
    command: ['npx', 'hf', 'serve', '--root', '{root}', '--port', '{port}'],
    root: 'dist/apps/demos/koi-pond/site',
    readyTimeoutMs: 180_000,
  },

  page: { path: '/' },

  determinism: {
    // why: the scene picks which framework anchors the shoal from the local hour
    clock: { time: '2026-01-01T09:00:00Z', resume: true },
    // why: the shoal size is read from the reported device capability, so it is pinned
    // why: rather than left to whatever machine happens to run the recording
    navigator: { hardwareConcurrency: 4, deviceMemory: 8 },
  },

  // why: the pill dot turns green only when every koi in the roster has answered
  ready: { selector: '.koi-shoal-pill .koi-shoal-dot[data-connected="true"]', timeoutMs: 180_000 },

  assert: { maxConsoleErrors: 0 },

  // why: long enough for the curtain to clear and for the shoal to have swum out of the
  // why: single clump it enters in; the koi are seeded, so a fixed settle is a fixed frame
  record: { settleMs: 14_000, durationMs: 0 },

  stills: [
    {
      name: 'preview',
      atMs: 0,
      format: 'webp',
      quality: 82,
      width: 640,
      maxBytes: 60_000,
    },
  ],
})
