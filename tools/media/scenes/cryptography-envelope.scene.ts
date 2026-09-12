import { envelopeStage } from '../src/envelope/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('cryptography')

/**
 * A secret sealed twice and opened once.
 *
 * `encrypt(secret, password)` hands back the secret wrapped in an envelope:
 * a fresh salt, a fresh initialisation vector, the cipher, and a tag that
 * seals all of it. So the frame is the envelope being made, drawn rather than
 * described: random material grows on either side of the secret, its letters
 * scramble, a lock drops shut. The same secret is sealed a second time below
 * and every block and every glyph comes out different, which is the property
 * a reader is least likely to assume. Then `decrypt`: the key that fits opens
 * the first envelope and the secret comes back; the key that does not fit
 * leaves the second one shut, and nothing comes out of it at all.
 *
 * Segment order and lengths are the library's own, verified against
 * `libs/cryptography/src/lib/encrypt/create-encrypt.ts` and
 * `libs/cryptography/src/lib/decrypt/create-decrypt.ts` on 2026-09-12: a
 * 16-byte salt from `getRandomValues(16)` at offset 0, a 12-byte IV from
 * `getRandomValues(12)` at offset 16, and from offset 28 the AES-GCM output,
 * which is the cipher at the secret's own length followed by the 16-byte
 * authentication tag. Both random runs are drawn fresh on every call, and
 * `decrypt` with the wrong password rejects rather than returning bytes.
 */
export default defineScriptedScene({
  slug: 'cryptography-envelope',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: envelopeStage,
  holdMs: 1_800,
  gif: { colours: 56, lossy: 60, maxBytes: 800_000 },
  stills: [{ name: 'poster', atMs: 11_000, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    api: { encrypt: 'encrypt', decrypt: 'decrypt', mark: identity.mark },
    secret: 'sk_live_9f2c41',
    salt: { name: 'salt', bytes: 16 },
    iv: { name: 'IV', bytes: 12 },
    tag: { name: 'tag', bytes: 16 },
    cipherName: 'ciphertext',
    plainMs: 600,
    restMs: 1_100,
  },
})
