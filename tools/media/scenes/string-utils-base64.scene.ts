import { defineScriptedScene } from '../src/scene/define-scene'
import { transcodeStage } from '../src/transcode/stage'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('string-utils')

/**
 * One word crossing from text to bytes to Base64, and back.
 *
 * `toBase64(text)` encodes the text as UTF-8 first and only then as Base64,
 * so `'café'` becomes the five bytes `63 61 66 C3 A9` and from them
 * `Y2Fmw6k=`. The frame is that crossing drawn rather than stated: each
 * character tile drops the bytes it is written as, `é` drops two, the bytes
 * close up into threes, and four characters of the result are drawn out of
 * a funnel under each three, the padding `=` out of the slot the last three
 * is short of. Then the platform's `btoa` has a turn at the same tiles. It
 * is a Latin-1 API: it reads `é` as its own code unit, the single byte `E9`,
 * so the pair collapses into one wrong byte and a copy of the result peels
 * off with a different tail, `6Q==` instead of `w6k=`, struck through. No
 * error is raised for that, which is why the copy is struck rather than
 * refused. The copy fades, and `fromBase64` folds the result back into its
 * bytes and the bytes back into `café`.
 *
 * Verified against `libs/utils/string/src/lib/to-base64/browser/to-base64.ts`
 * (`TextEncoder` first, then `btoa`) and
 * `libs/utils/string/src/lib/from-base64/browser/from-base64.ts` (`atob`,
 * then `TextDecoder`) on 2026-09-12, and every value executed on Node 24:
 * `'café'` is `63 61 66 C3 A9` in UTF-8, `toBase64('café')` is `Y2Fmw6k=`,
 * `btoa('café')` is `Y2Fm6Q==`, and `btoa('🎉')` throws.
 */
export default defineScriptedScene({
  slug: 'string-utils-base64',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: transcodeStage,
  holdMs: 1_800,
  // why: the rows fade out over low-contrast surfaces, and a merging tolerance above two units leaves their outlines on the resting frame
  gif: { colours: 56, lossy: 20, maxBytes: 800_000 },
  stills: [{ name: 'poster', atMs: 5_600, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    api: { encode: 'toBase64', decode: 'fromBase64', mark: identity.mark },
    characters: [
      { glyph: 'c', bytes: ['63'] },
      { glyph: 'a', bytes: ['61'] },
      { glyph: 'f', bytes: ['66'] },
      { glyph: 'é', bytes: ['C3', 'A9'] },
    ],
    encoded: 'Y2Fmw6k=',
    foreign: { name: 'btoa', character: 3, byte: 'E9', encoded: 'Y2Fm6Q==' },
    plainMs: 800,
    restMs: 900,
  },
})
