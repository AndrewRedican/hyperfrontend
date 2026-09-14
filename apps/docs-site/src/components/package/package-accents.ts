import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import identity from '../../../../../assets/brand/package-identity.json'

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
 * hue is what its own page feels like once a reader is inside it. Both halves
 * are read from the workspace's package identity file, which the media recorder
 * tints and draws a package's showcase media from, so a package's pages and its
 * assets agree on where on the wheel it sits.
 */
export const PACKAGE_ACCENT_HUES: Record<string, number> = fromEntries(entries(identity.packages).map(([name, entry]) => [name, entry.hue]))

/** Where a package with no hue of its own sits: the site's blue. */
const FALLBACK_HUE = identity.fallbackHue

/**
 * The hue a package's documentation is tinted with.
 *
 * @param packageName - Full npm package name
 * @returns A hue in degrees, falling back to the site's own blue
 *
 * @example Tinting a package page
 * ```tsx
 * <PageAccent hue={packageAccentHue('@hyperfrontend/nexus')} />
 * ```
 */
export function packageAccentHue(packageName: string): number {
  return PACKAGE_ACCENT_HUES[packageName] ?? FALLBACK_HUE
}
