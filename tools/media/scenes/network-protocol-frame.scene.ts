import type { SealedConfig } from '../src/models/sealed'
import { defineScriptedScene } from '../src/scene/define-scene'
import { sealedStage } from '../src/sealed/stage'
import { sealedTimeline } from '../src/sealed/timeline'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('network-protocol')

/**
 * The exchange the frame shows: the readme example's two ends, two messages,
 * and the copy of the second that is thrown out by its number.
 */
const config: SealedConfig = {
  api: { channel: 'createChannel', drop: 'onDrop', mark: identity.mark },
  ends: { sender: 'page', receiver: 'worker' },
  hello: 'hello',
  messages: 2,
  replayCode: 'replayed',
  restMs: 1_100,
}

/** Every moment on the timeline, so the poster can be taken at the refusal. */
const timeline = sealedTimeline(config)

/**
 * Two ends, a pipe, and a seal with a number on it.
 *
 * You own the transport; this package is the envelope on it. So the frame is
 * the transport, drawn as a pipe between two ends, and everything the package
 * does happens on or beside it. A hello crosses each way in the clear and the
 * same key appears at both ends. A message is wrapped into a numbered frame,
 * carried, and unwrapped by the far end's key; then another, numbered `2`. A
 * listener under the pipe copies the second frame and pushes the copy back
 * in. The receiver reads its number, sees it is not above the last one it
 * accepted, and drops it into the `onDrop` tray marked `replayed` without
 * ever touching a key.
 *
 * Verified against `libs/network-protocol/src/lib/protocol/session/frame.ts`
 * and `create-session-protocol.ts` on 2026-09-12: each end's hello carries
 * its nonce and P-256 public key in the clear; every sealed frame is a
 * ten-byte header (version, type, an eight-byte counter that is also the
 * nonce) followed by the AES-GCM output with its sixteen-byte tag; counters
 * start at 1 and must increase; `open` compares the counter against the last
 * one accepted and throws `replayed` before the session keys are awaited,
 * so a copied frame is refused before any key is touched. The code is
 * `ProtocolErrorCode.Replayed` in `libs/network-protocol/src/lib/security/errors.ts`,
 * and it reaches `onDrop` on the channel, as the readme's "Replay rejection
 * before decryption" states.
 */
export default defineScriptedScene({
  slug: 'network-protocol-frame',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: sealedStage,
  holdMs: 1_800,
  gif: { colours: 96, lossy: 40, maxBytes: 800_000 },
  stills: [{ name: 'poster', atMs: timeline.compareAt + 300, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config,
})
