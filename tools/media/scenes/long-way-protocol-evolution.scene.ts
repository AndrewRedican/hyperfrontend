import { negotiationStage } from '../src/negotiation/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { articleProfile } from './lib/article'
import { workspaceIdentity } from './lib/identity'

/** The workspace's hue. */
const identity = workspaceIdentity()

/**
 * The protocol lesson from "The Long Way Around": a channel that activates
 * itself against one that negotiates a session, on one clock.
 *
 * Both panels have a host that is up from the start and a hostee that takes
 * a moment to start. Above, the wire is live at once and the first message
 * lands on nothing. Below, the wire waits: hello goes unanswered, the
 * hostee's own hello arrives once it is up, the two accept and confirm, and
 * a session exists before any message is sent. The strip is the history
 * that produced the second panel: an envelope, the demos that broke it, and
 * the per-session protocols that replaced it. The poster is the moment
 * both panels are exchanging messages, one with a loss behind it and one
 * with a session.
 */
export default defineScriptedScene({
  slug: 'long-way-protocol-evolution',
  asset: 'figure',
  outputs: ['gif', 'still'],
  profile: articleProfile(532),
  hue: identity.hue,
  stage: negotiationStage,
  holdMs: 1_200,
  gif: { colours: 64, lossy: 60, maxBytes: 1_600_000 },
  stills: [{ name: 'poster', atMs: 6_900, format: 'webp', quality: 84, maxBytes: 140_000 }],
  config: {
    before: { caption: 'Before', note: 'the channel activates itself, whether or not anyone is listening' },
    after: { caption: 'Negotiated session', note: 'the channel waits for a handshake, and exists only once both sides agree' },
    host: 'host',
    hostee: 'hostee',
    booting: 'starting',
    ready: 'ready',
    waiting: 'waiting for peer',
    lost: 'lost',
    session: 'session',
    stripCaption: 'What the stress tests changed',
    stops: [
      { label: 'v1 / v2 envelope', note: 'the original security envelope' },
      { label: 'demo findings', note: 'cold start, heartbeat, liveness latches' },
      { label: 'v3 / v4 per session', note: 'the protocols that replaced it' },
    ],
  },
})
