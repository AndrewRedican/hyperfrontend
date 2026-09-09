import { defineBrowserScene } from '../src/scene/define-scene'

export default defineBrowserScene({
  slug: 'heartbeat-preview',
  asset: 'preview',
  outputs: ['still'],

  viewport: { width: 640, height: 640 },

  serve: {
    cwd: 'apps/demos/heartbeat',
    command: ['npx', 'hf', 'serve', '--root', '{root}', '--port', '{port}'],
    root: 'dist/apps/demos/heartbeat/app',
    readyTimeoutMs: 120_000,
  },

  page: { path: '/' },

  determinism: {
    clock: { time: '2026-01-01T10:09:30Z', resume: true },
    navigator: { hardwareConcurrency: 4, deviceMemory: 8 },
  },

  ready: { selector: 'svg.heart', timeoutMs: 60_000 },

  assert: { maxConsoleErrors: 0 },

  // why: long enough for the rhythm engine to reach its resting rate, so the caption under the
  // why: heart reads a settled bpm rather than the figure it starts from
  record: { settleMs: 3_000, durationMs: 0 },

  stills: [
    {
      name: 'preview',
      atMs: 0,
      // why: the heartbeat paints its own dark surface, so there is no transparency to keep and
      // why: asking for it would only cost the alpha channel's bytes
      format: 'webp',
      quality: 82,
      width: 640,
      maxBytes: 60_000,
    },
  ],
})
