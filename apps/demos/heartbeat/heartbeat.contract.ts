import type { FeatureContract } from '@hyperfrontend/features/hostee'

/**
 * Contract for the heartbeat feature.
 *
 * The feature owns the cardiac rhythm; the host observes it. Every heartbeat —
 * scheduled or visitor-triggered — crosses the boundary as a `beat` event,
 * rhythm changes cross as `rhythm`, and the host measures round-trip latency
 * with `ping`/`pong`. These are ordinary contract actions: the SDK's own
 * liveness heartbeat stays invisible infrastructure underneath them.
 */
const contract = {
  version: '0.1.0',
  accepted: [
    {
      type: 'ping',
      description:
        'Latency probe. Answered directly when sent as a request, and always echoed as a `pong` event carrying the original `sentAt`.',
      schema: {
        type: 'object',
        properties: {
          seq: { type: 'number' },
          sentAt: { type: 'number' },
        },
        required: ['seq', 'sentAt'],
      },
      respondsWith: 'pong',
    },
    {
      type: 'set-rate',
      description: 'Adjust the baseline rhythm rate in bpm, clamped to 40–180. Confirmed by a `rhythm` echo carrying the applied rate.',
      schema: {
        type: 'object',
        properties: {
          bpm: { type: 'number' },
        },
        required: ['bpm'],
      },
    },
  ],
  emitted: [
    {
      type: 'beat',
      description: 'One heartbeat — scheduled rhythm beats and visitor-triggered extras alike.',
      schema: {
        type: 'object',
        properties: {
          at: { type: 'number' },
          seq: { type: 'number' },
          bpm: { type: 'number' },
          source: { type: 'string', enum: ['rhythm', 'user'] },
        },
        required: ['at', 'seq', 'bpm', 'source'],
      },
    },
    {
      type: 'rhythm',
      description: 'A rhythm state transition or baseline-rate change, carrying the current pacing rate (0 while suppressed or flatlined).',
      schema: {
        type: 'object',
        properties: {
          state: { type: 'string', enum: ['beating', 'suppressed', 'flatline', 'recovering'] },
          bpm: { type: 'number' },
        },
        required: ['state', 'bpm'],
      },
    },
    {
      type: 'pong',
      description: 'Reply to a host `ping`; echoes `sentAt` so the host computes round-trip latency.',
      schema: {
        type: 'object',
        properties: {
          seq: { type: 'number' },
          sentAt: { type: 'number' },
        },
        required: ['seq', 'sentAt'],
      },
    },
  ],
} satisfies FeatureContract

export default contract
