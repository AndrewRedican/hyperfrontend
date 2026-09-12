import { byteStage } from '../src/byte/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * What your transport actually carries once the envelope is on it.
 *
 * This package does not move bytes; it decides what the bytes are. So the
 * frame is the subject, and the two numbers worth taking away are the ten
 * header bytes that travel in the clear and the sixteen tag bytes that make
 * the header impossible to edit: version, frame type and an eight-byte counter
 * are all a listener ever sees, and changing any of them fails the tag.
 *
 * The counter is the closing beat because it is the part a reader is least
 * likely to expect a transport wrapper to have opinions about. A frame whose
 * counter is not above the last accepted one is not delivered late; it is
 * dropped inside the open stage and reported with a code, which is what makes
 * a captured frame useless to replay.
 *
 * Verified against `libs/network-protocol/src/lib/protocol/session/frame.ts`:
 * `HEADER_LENGTH` 10, `TAG_LENGTH` 16, `NONCE_LENGTH` 12, `HELLO_LENGTH` 99
 * (2 + a 32-byte nonce + a 65-byte uncompressed P-256 point), the header being
 * `[version][0][counter as uint64 big-endian]`, and the nonce being four zero
 * bytes followed by the counter's own eight. The rejection codes are
 * `ProtocolErrorCode` in `libs/network-protocol/src/lib/security/errors.ts`.
 * The sealed length is the plaintext length because AES-GCM does not pad:
 * `{"type":"ORDER_PLACED","id":"A-1094"}` is 37 bytes, so the frame is 63.
 */
export default defineScriptedScene({
  slug: 'network-protocol-frame',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 243,
  stage: byteStage,
  holdMs: 1_700,
  gif: { colours: 48, lossy: 75, maxBytes: 800_000 },
  stills: [{ name: 'poster', atMs: 7_000, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    heading: 'Your transport. Our envelope.',
    source: "channel.send({ type: 'ORDER_PLACED', id: 'A-1094' })",
    caption: 'Ten bytes in the clear, and none of them can be edited without failing the tag.',
    restMs: 1_600,
    segments: [
      { label: 'version', count: 1, atMs: 900, tone: 'muted', note: '4' },
      { label: 'type', count: 1, atMs: 1_050, tone: 'muted', note: 'data' },
      { label: 'counter', count: 8, atMs: 1_200, fillMs: 500, tone: 'warning', note: 'uint64, big-endian' },
      { label: 'sealed packet', count: 37, atMs: 1_800, fillMs: 900, tone: 'accent', note: 'AES-GCM-256, no padding' },
      { label: 'tag', count: 16, atMs: 2_800, fillMs: 600, tone: 'success', note: 'covers the header too' },
    ],
    annotations: [
      { atMs: 3_700, text: 'the nonce is four zero bytes then the counter: unique by construction', tone: 'muted' },
      { atMs: 4_700, text: 'one 99-byte plaintext hello keyed this: nonce + P-256 public key', tone: 'muted' },
      { atMs: 5_900, text: 'a listener replays the frame verbatim', tone: 'warning' },
      { atMs: 6_800, text: "onDrop({ code: 'replayed' })  ->  never reaches your handler", tone: 'danger' },
    ],
  },
})
