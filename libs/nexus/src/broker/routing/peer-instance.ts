/**
 * Instance identity check applied to inbound frames.
 *
 * @module broker/routing/peer-instance
 */

import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'

/**
 * Reports whether an action came from the counterpart instance the channel is
 * connected to.
 *
 * A window outlives the documents loaded into it, so resolving a frame by its
 * source window identifies the *window*, not the instance inside it. Every
 * broker mints an id when it boots and stamps it on every action it sends, and
 * the channel records the counterpart's at handshake time — so comparing the
 * two rejects frames left over from a previous incarnation (or sent by a second
 * broker sharing the counterpart's document) instead of accepting them into the
 * current session.
 *
 * A channel with no recorded counterpart admits everything the window and
 * origin checks already allowed: there is no instance to be stale against
 * before a handshake completes, and a channel activated directly (rather than
 * through the handshake) may never learn one.
 *
 * The id is cooperative, not a credential — any script that can post to the
 * window can claim one. It is authenticated only inside an encrypted envelope,
 * where producing a frame at all requires the negotiated key.
 *
 * @param channel - Channel the frame resolved to
 * @param action - The inbound action
 * @returns True when the action may act on this channel's session
 *
 * @example Dropping a frame from a stale instance
 * ```typescript
 * if (!isPeerInstance(channel, action)) {
 *   return
 * }
 * ```
 */
export function isPeerInstance(channel: ChannelHandle, action: IAction): boolean {
  const peerId = channel.getPeerId()
  return peerId === null || peerId === <string>action.senderId
}
