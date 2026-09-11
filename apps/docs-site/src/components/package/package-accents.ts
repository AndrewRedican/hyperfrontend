/**
 * Hue a package's own pages are tinted with, keyed by npm package name.
 *
 * One number rather than a colour, and rather than a light/dark pair. The only
 * thing this feeds is the wash behind a package's documentation, where the
 * stylesheet supplies the saturation, the lightness and the alpha per theme;
 * what a package gets to decide is where on the wheel its page sits. That is
 * deliberately the smallest possible say: a hue cannot make text harder to read
 * the way a colour can, so a package can carry a character of its own without
 * anything here needing to be checked for contrast twice.
 *
 * Hues are grouped so that packages solving the same problem sit near each
 * other and the reader who moves between them feels a family rather than a
 * shuffle. Everything stays in the cool half of the wheel that the rest of the
 * site occupies, apart from the build and release tooling, which is the one
 * group a reader arrives at from a different direction.
 *
 * Marks stay colourless; the geometry in `package-marks.ts` still inherits
 * whatever it is placed in. These two are different halves of one identity:
 * the mark is what a package looks like on a card beside twenty others, and the
 * hue is what its own page feels like once a reader is inside it.
 */
export const PACKAGE_ACCENT_HUES: Record<string, number> = {
  /* The SDK, on the site's own blue. */
  '@hyperfrontend/features': 217,

  /* Messaging and transport: blue running toward indigo as the layer gets lower. */
  '@hyperfrontend/nexus': 228,
  '@hyperfrontend/network-protocol': 243,

  /* Security, at the violet end where the transport stack finishes. */
  '@hyperfrontend/cryptography': 268,

  /* Build and release tooling, the one group off the cool half: a warmer amber
     for the things that run before anything ships. */
  '@hyperfrontend/builder': 32,
  '@hyperfrontend/versioning': 22,
  '@hyperfrontend/project-scope': 44,
  '@hyperfrontend/questions': 12,

  /* Runtime primitives, in the teal band between the utilities and the stack. */
  '@hyperfrontend/state-machine': 172,
  '@hyperfrontend/logging': 190,
  '@hyperfrontend/web-worker': 158,

  /* Utilities, spread across the cyan-to-magenta arc so that twenty small
     packages are still told apart by the page they open. */
  '@hyperfrontend/immutable-api-utils': 288,
  '@hyperfrontend/data-utils': 202,
  '@hyperfrontend/json-utils': 210,
  '@hyperfrontend/string-utils': 196,
  '@hyperfrontend/list-utils': 184,
  '@hyperfrontend/time-utils': 252,
  '@hyperfrontend/random-generator-utils': 306,
  '@hyperfrontend/function-utils': 260,
  '@hyperfrontend/ui-utils': 322,
}

/** Where a package with no hue of its own sits: the site's blue. */
const FALLBACK_HUE = 217

/**
 * The hue a package's documentation is tinted with.
 *
 * @param packageName - Full npm package name
 * @returns A hue in degrees, falling back to the site's own blue
 *
 * @example Tinting a package page
 * ```tsx
 * <main style={{ '--page-accent': packageAccentHue('@hyperfrontend/nexus') }}>
 * ```
 */
export function packageAccentHue(packageName: string): number {
  return PACKAGE_ACCENT_HUES[packageName] ?? FALLBACK_HUE
}
