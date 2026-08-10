import type { FeatureContract } from '@hyperfrontend/features/hostee'

/**
 * Contract for the koi pond itself.
 *
 * The pond is a host to seven koi and a hostee to the docs-site gallery, and
 * only the outer relationship crosses this contract. Nothing about an individual
 * fish appears here: the gallery does not know there are seven apps in the
 * scene, and does not need to.
 *
 * What it does need is the end of a sequence. In the expanded dialog a click
 * disturbs the water, the shoal scatters, and once every koi has settled back
 * into an ambient cruise the pond says so — which is the gallery's cue to
 * collapse the dialog back to its card.
 */
const contract = {
  version: '0.1.0',
  accepted: [
    {
      type: 'set-scene',
      description:
        'How the pond is being presented. `card` damps the ambient motion for a small embedded frame; `full` runs the scene at its intended scale.',
      schema: {
        type: 'object',
        properties: { scene: { type: 'string', enum: ['card', 'full'] } },
        required: ['scene'],
      },
    },
    {
      type: 'disturb',
      description:
        'Strike the water on the gallery’s behalf, as a fraction across the pond, so a host can demonstrate the scatter without a pointer.',
      schema: {
        type: 'object',
        properties: {
          fx: { type: 'number' },
          fy: { type: 'number' },
        },
        required: ['fx', 'fy'],
      },
    },
  ],
  emitted: [
    {
      type: 'shoal',
      description:
        'How many koi are currently connected and swimming, sent whenever that changes. The gallery uses it to tell a settling pond from a broken one.',
      schema: {
        type: 'object',
        properties: {
          connected: { type: 'number' },
          expected: { type: 'number' },
        },
        required: ['connected', 'expected'],
      },
    },
    {
      type: 'sequence-complete',
      description: 'A disturbance sequence finished unwinding — the scatter resolved and every koi resumed ambient cruising.',
      schema: {
        type: 'object',
        properties: { fish: { type: 'number' } },
        required: ['fish'],
      },
    },
    {
      type: 'close-request',
      description:
        'The visitor activated the dialog close control inside the pond. The host owns the presentation and performs the actual close.',
      schema: {
        type: 'object',
        properties: {
          source: { type: 'string', enum: ['button'] },
        },
        required: ['source'],
      },
    },
  ],
} satisfies FeatureContract

export default contract
