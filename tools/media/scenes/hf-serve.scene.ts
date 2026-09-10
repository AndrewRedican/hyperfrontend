import { defineScriptedScene } from '../src/scene/define-scene'
import { terminalStage } from '../src/terminal/stage'

export default defineScriptedScene({
  slug: 'hf-serve',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'docs-wide',
  stage: terminalStage,
  holdMs: 1_400,
  gif: { colours: 64, lossy: 60, maxBytes: 1_200_000 },
  stills: [{ name: 'poster', atMs: 8_200, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    theme: 'midnight',
    title: 'hyperfrontend',
    prompt: '~/storefront',
    script: [
      { step: 'pause', ms: 700 },
      { step: 'type', text: 'npx hf build' },
      { step: 'run', thinkMs: 520 },
      {
        step: 'output',
        lineMs: 260,
        lines: [
          { text: '  checkout   dist/checkout      42.1 kB', tone: 'muted' },
          { text: '  search     dist/search        18.7 kB', tone: 'muted' },
          { text: '  reviews    dist/reviews       23.4 kB', tone: 'muted' },
          { text: '', tone: 'muted' },
          { text: '  3 features built', tone: 'success' },
        ],
      },
      { step: 'pause', ms: 900 },
      { step: 'type', text: 'npx hf serve --root dist' },
      { step: 'run', thinkMs: 420 },
      {
        step: 'output',
        lineMs: 300,
        lines: [
          { text: '  checkout   http://localhost:4310', tone: 'accent' },
          { text: '  search     http://localhost:4311', tone: 'accent' },
          { text: '  reviews    http://localhost:4312', tone: 'accent' },
          { text: '', tone: 'muted' },
          { text: '  ready. the host can mount any of them.', tone: 'plain' },
        ],
      },
      { step: 'pause', ms: 1_600 },
    ],
  },
})
