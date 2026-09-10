import { flowStage } from '../src/flow/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

export default defineScriptedScene({
  slug: 'feature-handshake',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  stage: flowStage,
  holdMs: 1_200,
  gif: { colours: 48, lossy: 70, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 7_600, format: 'webp', quality: 82, maxBytes: 60_000 }],
  config: {
    theme: 'midnight',
    left: { title: 'Host', subtitle: 'shop.example.com' },
    right: { title: 'Feature', subtitle: 'checkout' },
    messages: [
      { from: 'left', label: 'HELLO', atMs: 700, tone: 'muted' },
      { from: 'right', label: 'HELLO_ACK', atMs: 2_000, tone: 'muted' },
      { from: 'left', label: 'CONTRACT', atMs: 3_300 },
      { from: 'right', label: 'CONTRACT_ACK', atMs: 4_600 },
      { from: 'left', label: 'OPEN', atMs: 5_900, tone: 'accent' },
      { from: 'right', label: 'READY', atMs: 7_200, tone: 'success' },
    ],
    settled: 'channel open, contract agreed',
    restMs: 1_400,
  },
})
