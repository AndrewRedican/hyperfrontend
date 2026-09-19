import { composeStage } from '../src/compose/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'
import { readmeProfile } from './lib/readme'

/** The flagship's hue and mark. */
const identity = packageIdentity('features')

/**
 * The repository readme's hero: three applications on three stacks, each
 * served from its own origin, seating into one host page at run time.
 *
 * The windows arrive one after another and keep their own chrome and
 * address inside the host, which is the whole claim: nothing is rewritten
 * and nothing shares a runtime. A wire draws itself from the host's hub to
 * each seated window, and once all three are live, named messages cross in
 * both directions. The framework tags are the vocabulary of the idea and the
 * only words in the frame besides the origins and the action names.
 *
 * Recorded in the portable theme only, because the one page that shows it
 * is the readme on GitHub, whose theme nobody here controls.
 */
export default defineScriptedScene({
  slug: 'readme-compose',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: readmeProfile(468),
  themes: ['portable'],
  hue: identity.hue,
  stage: composeStage,
  holdMs: 1_800,
  gif: { colours: 96, lossy: 30, maxBytes: 1_200_000 },
  stills: [{ name: 'poster', atMs: 9_400, format: 'png', quality: 90, maxBytes: 160_000 }],
  config: {
    hostOrigin: 'app.example.com',
    mark: identity.mark,
    features: [
      { origin: 'checkout.team-b.dev', framework: 'React', dockAtMs: 700 },
      { origin: 'reports.team-c.io', framework: 'Angular', dockAtMs: 2_300 },
      { origin: 'billing.legacy.corp', framework: 'jQuery', dockAtMs: 3_900 },
    ],
    messages: [
      { feature: 0, direction: 'to-host', atMs: 6_100, label: 'order-placed' },
      { feature: 2, direction: 'to-feature', atMs: 7_000, label: 'invoice' },
      { feature: 1, direction: 'to-host', atMs: 7_900, label: 'range-changed' },
    ],
    restMs: 800,
  },
})
