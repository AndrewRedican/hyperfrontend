import { byteStage } from '../src/byte/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * What one call to `encrypt` actually hands back.
 *
 * The reason to show the layout rather than the call is that the layout is the
 * part a reader has to trust. `encrypt(message, password)` returns fifty-eight
 * bytes for a fourteen-byte secret, and the thirty-four it added are not
 * padding: they are a fresh sixteen-byte salt, a fresh twelve-byte
 * initialisation vector and a sixteen-byte authentication tag, each of which
 * has to be there for the same call to be safe to make twice. Watching them
 * assemble is the fastest way to see that none of them is yours to manage.
 *
 * The closing beat is the same call running again on the same input and
 * producing a different buffer, which is the property that matters most and
 * the one a reader is least likely to assume.
 *
 * Every number here was executed against the built package at
 * `dist/libs/cryptography/node/index.esm.js` on Node 24.18 on 2026-09-10:
 * the length is 58, two runs differ, `decrypt` returns the original string,
 * and a wrong password rejects with a `DOMException` named `OperationError`.
 */
export default defineScriptedScene({
  slug: 'cryptography-envelope',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 268,
  stage: byteStage,
  holdMs: 1_700,
  gif: { colours: 48, lossy: 75, maxBytes: 800_000 },
  stills: [{ name: 'poster', atMs: 6_400, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    heading: 'One call. Salt, IV and tag are not your problem.',
    source: "await encrypt('sk_live_9f2c41', 'vault-password')",
    caption: 'Uint8Array(58). Run it again and only the length is the same.',
    restMs: 1_600,
    segments: [
      { label: 'salt', count: 16, atMs: 900, fillMs: 700, tone: 'accent', note: 'fresh per call' },
      { label: 'IV', count: 12, atMs: 1_700, fillMs: 520, tone: 'success', note: 'fresh per call' },
      { label: 'ciphertext', count: 14, atMs: 2_300, fillMs: 620, tone: 'plain', note: 'AES-GCM-256' },
      { label: 'tag', count: 16, atMs: 3_000, fillMs: 640, tone: 'warning', note: 'authenticates all of it' },
    ],
    annotations: [
      { atMs: 4_000, text: 'PBKDF2-SHA-256, 100,000 iterations, from the password', tone: 'muted' },
      { atMs: 4_900, text: "decrypt(buffer, 'vault-password')  ->  'sk_live_9f2c41'", tone: 'success' },
      { atMs: 6_000, text: "decrypt(buffer, 'guess')  ->  DOMException: OperationError", tone: 'danger' },
      { atMs: 7_400, text: 'encrypt the same secret again  ->  a different 58 bytes', tone: 'accent' },
    ],
  },
})
