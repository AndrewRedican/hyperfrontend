import { defineBrowserScene } from '../src/scene/define-scene'

export default defineBrowserScene({
  slug: 'koi-pond',
  outputs: ['gif'],

  // why: sqrt(1440*810) is 1080, over the 1000 threshold that seats the full eight-koi
  // why: shoal, and 16:9 so the hero needs no crop
  viewport: { width: 1440, height: 810 },

  serve: {
    build: ['npx', 'nx', 'run-many', '-t', 'build', '-p', 'demo-koi-*'],
    // why: hf serve sends the production COOP/COEP/CSP headers a plain static server does not
    cwd: 'apps/demos/koi-pond/host',
    command: ['npx', 'hf', 'serve', '--root', '{root}', '--port', '{port}'],
    root: 'dist/apps/demos/koi-pond/site',
    readyTimeoutMs: 120_000,
  },

  page: { path: '/' },

  determinism: {
    // why: the scene picks which framework anchors the shoal from the local hour,
    // why: and resume keeps time running so the koi still swim and stills still work
    clock: { time: '2026-01-01T09:00:00Z', resume: true },
    // why: the shoal size is read from the reported device capability, so it is pinned
    // why: rather than left to whatever machine happens to run the recording
    // why: four cores with eight gigabytes is the middle tier, which seats exactly the
    // why: eight koi the roster then reads back as "8 of 8" rather than "8 of 12"
    navigator: { hardwareConcurrency: 4, deviceMemory: 8 },
  },

  // why: the pill dot turns green only when every koi in the roster has answered;
  // why: the curtain opens on a five second deadline whether they have or not
  ready: { selector: '.koi-shoal-pill .koi-shoal-dot[data-connected="true"]', timeoutMs: 120_000 },

  assert: {
    maxConsoleErrors: 0,
    // why: eight independently built framework apps is the claim the hero makes
    expect: [{ selector: '.koi-layer', count: 8 }],
  },

  record: { settleMs: 3_000, durationMs: 18_000 },

  // why: measured on this scene, a full palette with only gentle lossy compression is
  // why: visually indistinguishable from lossless at a quarter less size, and the water
  // why: gradient is what gives up first when the palette is cut
  gif: { width: 560, fps: 10, colours: 256, lossy: 15, dither: true, loop: 0, maxBytes: 2_000_000 },
})
