import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * The same four strings, handed to the platform's encoder and to this one.
 *
 * `btoa` is not a UTF-8 API and never was. It takes a string of Latin-1 code
 * units, so a code point above 255 throws and a code point between 128 and 255
 * is quietly encoded as the single byte it happens to be. Both failures are in
 * the frame, and the quiet one is why this package exists: `btoa('café')`
 * returns `Y2Fm6Q==` rather than raising, which is a real answer to a question
 * nobody asked. It wrote `é` as `E9`, its own code unit, where UTF-8 spells it
 * `C3 A9` and `toBase64` returns `Y2Fmw6k=`. Nothing throws, so nothing is
 * caught, and the corruption travels; that is the one row in the frame that is
 * struck through rather than coloured as a failure.
 *
 * The browser implementation is not a reimplementation of base64. It runs the
 * text through `TextEncoder` first and hands `btoa` the bytes as a binary
 * string, which is the whole of the fix and worth saying on screen.
 *
 * The closing line is the other half of the signature. `toBase64(text, urlSafe)`
 * maps `+` to `-` and `/` to `_`, and the padding comes off only inside that
 * branch, so the emoji (whose base64 carries a `+`) is the one input that shows
 * both transforms at once.
 *
 * Verified against `libs/utils/string/src/lib/to-base64/browser/to-base64.ts`
 * (the signature, both defaults, and the `TextEncoder` then `btoa` order),
 * `libs/utils/string/src/lib/utils/base64-to-url-safe-base64.ts` (padding is
 * stripped only when `urlSafe` is set), `libs/utils/string/src/lib/test-fixtures.ts`
 * and `libs/utils/string/src/lib/to-base64/browser.spec.ts` (which assert that
 * `'こんにちは'` encodes to `44GT44KT44Gr44Gh44Gv`). Every other value was
 * executed on Node 24.18.0 on 2026-09-10: `btoa` throws a `DOMException` named
 * `InvalidCharacterError` for the CJK and the emoji input, returns `Y2Fm6Q==`
 * for `'café'`, and `fromBase64('Y2Fmw6k=')` gives `'café'` back.
 */
export default defineScriptedScene({
  slug: 'string-utils-base64',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'docs-wide',
  stage: panelStage,
  holdMs: 1_400,
  gif: { colours: 64, lossy: 75, maxBytes: 1_000_000 },
  stills: [{ name: 'poster', atMs: 7_400, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    theme: 'midnight',
    heading: 'btoa is a Latin-1 API. toBase64 encodes UTF-8 first, so all four inputs survive.',
    caption: 'urlSafe maps + to - and / to _; the padding comes off only when urlSafe is on.',
    restMs: 1_600,
    panels: [
      {
        title: 'input',
        kind: 'code',
        weight: 0.95,
        rows: [
          { text: "'Hello, World!'", atMs: 220, typeMs: 620 },
          { text: 'thirteen ASCII bytes', atMs: 900, tone: 'muted' },
          { text: '', atMs: 1_400 },
          { text: "'café'", atMs: 1_700, typeMs: 340 },
          { text: 'é is C3 A9, two bytes', atMs: 2_120, tone: 'muted' },
          { text: '', atMs: 3_100 },
          { text: "'こんにちは'", atMs: 3_500, typeMs: 340 },
          { text: 'three bytes per char', atMs: 3_920, tone: 'muted' },
          { text: '', atMs: 4_700 },
          { text: "'🎉'", atMs: 5_100 },
          { text: 'four bytes, one code point', atMs: 5_320, tone: 'muted' },
          { text: '', atMs: 6_100 },
          { text: "'🎉', urlSafe: true", atMs: 6_600 },
        ],
      },
      {
        title: 'btoa(input)',
        kind: 'result',
        rows: [
          { text: 'SGVsbG8sIFdvcmxkIQ==', atMs: 1_080, tone: 'success' },
          { text: 'both agree on ASCII', atMs: 1_260, tone: 'muted' },
          { text: '', atMs: 1_400 },
          { text: 'Y2Fm6Q==', atMs: 2_340, tone: 'danger', strike: true },
          { text: 'read as one byte: E9', atMs: 2_700, tone: 'muted' },
          { text: '', atMs: 3_100 },
          { text: 'throws DOMException', atMs: 4_140, tone: 'danger' },
          { text: 'InvalidCharacterError', atMs: 4_300, tone: 'danger' },
          { text: '', atMs: 4_700 },
          { text: 'throws DOMException', atMs: 5_540, tone: 'danger' },
          { text: 'InvalidCharacterError', atMs: 5_700, tone: 'danger' },
        ],
      },
      {
        title: 'toBase64(input)',
        kind: 'result',
        rows: [
          { text: 'SGVsbG8sIFdvcmxkIQ==', atMs: 1_080, tone: 'success' },
          { text: 'TextEncoder, then btoa', atMs: 1_260, tone: 'muted' },
          { text: '', atMs: 1_400 },
          { text: 'Y2Fmw6k=', atMs: 2_340, tone: 'success' },
          { text: "fromBase64 gives 'café'", atMs: 2_700, tone: 'muted' },
          { text: '', atMs: 3_100 },
          { text: '44GT44KT44Gr44Gh44Gv', atMs: 4_140, tone: 'success' },
          { text: '', atMs: 4_300 },
          { text: '', atMs: 4_700 },
          { text: '8J+OiQ==', atMs: 5_540, tone: 'success' },
          { text: '', atMs: 5_700 },
          { text: '', atMs: 6_100 },
          { text: '8J-OiQ', atMs: 7_200, tone: 'accent', emphasis: true },
        ],
      },
    ],
  },
})
