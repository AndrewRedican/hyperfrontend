import { portsStage } from '../src/ports/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('nexus')

/**
 * Two brokers open a channel, and then only the shapes that fit get in.
 *
 * Each broker's contract lists the types it emits and the types it accepts,
 * and once the channel is open a message is delivered only if its type is in
 * the receiver's own `accepted` list; anything else arrives and is dropped,
 * with no handler run and nothing thrown. So the frame draws a contract as a
 * shape: each broker has a slot cut into its inner edge for every type it
 * accepts, and each message is a token cast in its type's shape. Three plain
 * pulses cross a dashed wire and light it solid, which is the handshake. Then
 * the host's triangle crosses and seats in the cart's triangle slot, the
 * cart's circle crosses and seats in the host's circle slot, and the cart's
 * diamond crosses to a host with no diamond slot, stops at the boundary,
 * and falls away.
 *
 * The contracts are the package readme's own: `host-app` emits
 * `THEME_CHANGED` and accepts `CART_UPDATED`; `cart-app` emits
 * `CART_UPDATED` and `PRICE_SYNC` and accepts `THEME_CHANGED`. The order and
 * direction of the three pulses are the wire's: the initiator's
 * `[nexus] connection-request`, the responder's
 * `[nexus] connection-request-accepted`, the initiator's
 * `[nexus] connection-opened`. Verified on 2026-09-12 against
 * `libs/nexus/src/types/action.ts` (the wire names),
 * `libs/nexus/src/broker/routing/handle-open.ts` (OPEN completes the
 * handshake on the responder), `libs/nexus/src/channel/state/activate.ts`
 * (accepted types come from the channel's own contract, never the
 * counterpart's), `libs/nexus/src/broker/routing/handle-message.ts` (a type
 * outside that list is logged and dropped before any handler runs) and
 * `libs/nexus/src/channel/messaging/send.ts` (the sender only refuses a type
 * outside its own `emitted` list, so `PRICE_SYNC` travels).
 */
export default defineScriptedScene({
  slug: 'nexus-handshake',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: portsStage,
  holdMs: 1_800,
  gif: { colours: 96, lossy: 60, dither: false, maxBytes: 800_000 },
  stills: [{ name: 'poster', atMs: 10_100, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    mark: identity.mark,
    left: { label: 'host-app', api: 'createBroker', accepts: ['CART_UPDATED'] },
    right: { label: 'cart-app', api: 'addChannel', accepts: ['THEME_CHANGED'] },
    types: [
      { type: 'THEME_CHANGED', shape: 'triangle', tone: 'accent' },
      { type: 'CART_UPDATED', shape: 'circle', tone: 'success' },
      { type: 'PRICE_SYNC', shape: 'diamond', tone: 'warning' },
    ],
    pulses: [
      { from: 'left', atMs: 400 },
      { from: 'right', atMs: 1_400 },
      { from: 'left', atMs: 2_400 },
    ],
    pulseMs: 800,
    messages: [
      { from: 'left', type: 'THEME_CHANGED', atMs: 4_200 },
      { from: 'right', type: 'CART_UPDATED', atMs: 6_500 },
      { from: 'right', type: 'PRICE_SYNC', atMs: 8_800 },
    ],
    crossMs: 1_000,
    restMs: 1_100,
  },
})
