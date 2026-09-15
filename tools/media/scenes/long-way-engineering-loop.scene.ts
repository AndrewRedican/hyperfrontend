import { loopStage } from '../src/loop/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { articleProfile } from './lib/article'
import { workspaceIdentity } from './lib/identity'

/** The workspace's hue. */
const identity = workspaceIdentity()

/**
 * The human and model engineering loop from "The Long Way Around".
 *
 * A person defines the problem; a model proposes several implementations;
 * rails that neither of them can argue with (typecheck, tests, lint, the
 * repository's own rules) let one through; a person reviews it; and the
 * accepted change comes back as one more rail. The candidates that stop at
 * the rails are the point: nondeterministic generation inside deterministic
 * constraints, drawn rather than said. The poster is the moment two of three
 * candidates have failed and the third is passing.
 */
export default defineScriptedScene({
  slug: 'long-way-engineering-loop',
  asset: 'figure',
  outputs: ['gif', 'still'],
  profile: articleProfile(496),
  hue: identity.hue,
  stage: loopStage,
  holdMs: 900,
  gif: { colours: 64, lossy: 60, maxBytes: 1_600_000 },
  stills: [{ name: 'poster', atMs: 5_650, format: 'webp', quality: 84, maxBytes: 140_000 }],
  config: {
    caption: 'Nondeterministic generation inside deterministic constraints',
    define: { who: 'Human', title: 'Define the problem', note: 'constraints, acceptance criteria' },
    propose: { who: 'Model', title: 'Implement, propose', note: 'several candidates, none guaranteed' },
    review: { who: 'Human', title: 'Review', note: 'architecture, behaviour, trade-offs' },
    railsCaption: 'Deterministic rails',
    rails: ['typecheck', 'tests', 'lint', 'repository rules'],
    nextRail: 'the next rule',
    feedback: 'accepted changes become new tests, rules and skills',
  },
})
