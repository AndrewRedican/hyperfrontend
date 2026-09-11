import { flowStage } from '../src/flow/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * The gap between "we are closing" and "we are closed".
 *
 * Closing a session is not an event, it is a duration, and that duration is
 * the entire feature. The moment a close is proposed the channel is still
 * live: `closing` fires on both sides while messages still deliver, the
 * feature gets its window to push out whatever it was holding, and only then
 * does the acknowledgement land and the channel go down.
 *
 * A window is the archetypal thing to animate and close to impossible to write
 * down: eleven lines of prose in the nexus architecture and a footnote on a
 * diagram currently carry it. Here the phase caption names the window while it
 * is open, and the draft crosses inside it, which is the whole argument.
 *
 * The `__hf:dirty` beat at the start is what makes the window worth having:
 * the host asked to close, saw the feature was holding unsaved work, and the
 * exchange it started is the one that gets the work out rather than the one
 * that discards it.
 *
 * Verified against `libs/nexus/src/types/action.ts` (`[nexus] connection-closed`
 * and `[nexus] connection-closed-acknowledged`),
 * `libs/nexus/src/broker/routing/handle-close.ts` (`closing` is fired while the
 * channel is still active, deliberately, so subscribers can flush messages that
 * deliver before the acknowledgement), and
 * `libs/features/src/shared/control.ts` (`__hf:dirty` is the feature's own
 * declaration that it holds unsaved work).
 */
export default defineScriptedScene({
  slug: 'feature-flush-window',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  stage: flowStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 75, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 7_800, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    theme: 'midnight',
    left: { title: 'Host', subtitle: 'shop.example.com', note: 'the reader clicked away' },
    right: { title: 'Feature', subtitle: 'checkout.example.com', note: 'holding an unsaved draft' },
    phases: [
      { atMs: 0, label: 'Open' },
      { atMs: 2_400, label: 'Closing: the channel still delivers' },
      { atMs: 8_200, label: 'Closed' },
    ],
    settled: 'Nothing was discarded. The window is what the draft left through.',
    restMs: 1_700,
    messages: [
      {
        from: 'right',
        label: '__hf:dirty',
        detail: '{ dirty: true }, so the host knows there is work',
        atMs: 500,
        flightMs: 800,
        tone: 'muted',
      },
      {
        from: 'left',
        label: '[nexus] connection-closed',
        detail: 'both sides fire closing; the channel is still up',
        atMs: 2_600,
        flightMs: 800,
        tone: 'accent',
      },
      {
        from: 'right',
        label: 'draft-saved',
        detail: 'an ordinary message, sent after the close was proposed',
        atMs: 4_200,
        flightMs: 800,
        tone: 'success',
      },
      {
        from: 'right',
        label: '__hf:dirty',
        detail: '{ dirty: false }, and there is nothing left to lose',
        atMs: 5_700,
        flightMs: 800,
        tone: 'muted',
      },
      {
        from: 'right',
        label: '[nexus] connection-closed-acknowledged',
        detail: 'now the channel goes down, on both sides',
        atMs: 7_100,
        flightMs: 900,
        tone: 'warning',
      },
    ],
  },
})
