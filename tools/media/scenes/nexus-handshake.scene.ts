import { flowStage } from '../src/flow/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * A channel opening, and then the first thing it refuses.
 *
 * The three frames of the handshake are the real ones, in the real order.
 * `[nexus] connection-request` carries the initiator's contract and is re-sent
 * every 500 ms until something answers it. `[nexus] connection-request-accepted`
 * carries the responder's contract, and is the moment the responder pins the
 * origin it will talk to and runs its gates: structural contract validation,
 * required actions, the channel's `contractCompat` rule, then the broker's
 * `securityPolicy`. `[nexus] connection-opened` closes it, and both sides fire
 * `open` with `{ origin, contract }`.
 *
 * What that bought is the last third of the frame, and it is the part worth
 * recording. A channel's accepted types come from its own contract rather than
 * its counterpart's, so the cart is free to emit `PRICE_SYNC` (it is in the
 * cart's own `emitted` list, and `send` would have thrown at the sender
 * otherwise) into a host that never accepted it. The message crosses, arrives,
 * and stops: no handler runs, nothing throws, and the only trace is the line
 * under the diagram, which is the sentence `handleMessage` hands to
 * `logger.info` with the broker's name and the channel's name in it. A dropped
 * type is not an event anybody can subscribe to, and drawing it as one would
 * have been the comfortable lie.
 *
 * The contracts are the package readme's own: a `host-app` broker emitting
 * `THEME_CHANGED` and accepting `CART_UPDATED`, with the cart frame on the
 * other end of `addChannel('cart', frame)`. Only the two app names and the
 * `PRICE_SYNC` type are the scene's invention.
 *
 * Verified against `libs/nexus/src/types/action.ts` (the wire names),
 * `libs/nexus/src/broker/routing/handle-request.ts` (the gates, in that order,
 * on the responder) with `libs/nexus/src/channel/lifecycle/begin-response.ts`
 * (the origin pinned as ACCEPT leaves), `libs/nexus/src/broker/routing/handle-accept.ts`
 * and `handle-open.ts` (OPEN sent by the initiator, `open` fired on both sides),
 * `libs/nexus/src/broker/routing/handle-message.ts` with its spec (the drop and
 * the exact log sentence), `libs/nexus/src/channel/state/activate.ts` (accepted
 * types come from the channel's own contract), `libs/nexus/src/core/actions/message.ts`
 * (a user message rides inside `[nexus] new-message`),
 * `libs/nexus/src/channel/messaging/send.ts` (an unemitted type throws at the
 * sender instead of travelling), and `libs/nexus/src/constants/defaults.ts` with
 * `channel/lifecycle/handshake-timers.ts` (the 500 ms re-send cadence).
 */
export default defineScriptedScene({
  slug: 'nexus-handshake',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 228,
  stage: flowStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 75, maxBytes: 850_000 },
  stills: [{ name: 'poster', atMs: 8_150, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    left: { title: 'host-app', subtitle: 'shop.example.com', note: 'accepted: [CART_UPDATED]' },
    right: { title: 'cart-app', subtitle: 'cart.example.com', note: 'emitted: [CART_UPDATED, PRICE_SYNC]' },
    phases: [
      { atMs: 0, label: 'Three-way handshake' },
      { atMs: 4_400, label: 'Open channel' },
      { atMs: 7_300, label: 'Off the contract' },
    ],
    settled: "host-app dropped message type 'PRICE_SYNC' not accepted by the cart channel contract",
    restMs: 1_600,
    messages: [
      {
        from: 'left',
        label: '[nexus] connection-request',
        detail: "host-app's contract, re-sent every 500 ms until answered",
        atMs: 400,
        flightMs: 900,
        tone: 'muted',
      },
      {
        from: 'right',
        label: '[nexus] connection-request-accepted',
        detail: 'the cart contract; the responder pins the origin',
        atMs: 1_800,
        flightMs: 900,
        tone: 'muted',
      },
      {
        from: 'left',
        label: '[nexus] connection-opened',
        detail: 'both sides fire open({ origin, contract })',
        atMs: 3_200,
        flightMs: 900,
        tone: 'accent',
      },
      {
        from: 'left',
        label: 'THEME_CHANGED',
        detail: "inside [nexus] new-message: { theme: 'dark' }",
        atMs: 4_800,
        flightMs: 800,
        tone: 'plain',
      },
      {
        from: 'right',
        label: 'CART_UPDATED',
        detail: 'host-app accepts it, so onMessage runs',
        atMs: 6_100,
        flightMs: 800,
        tone: 'success',
      },
      {
        from: 'right',
        label: 'PRICE_SYNC',
        detail: 'it arrives, and no onMessage handler runs',
        atMs: 7_700,
        flightMs: 900,
        tone: 'muted',
      },
    ],
  },
})
