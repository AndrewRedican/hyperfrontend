import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import identity from '../../../../../assets/brand/package-identity.json'

/** One drawn element of a mark. */
export interface PackageMarkShape {
  /** SVG element to draw */
  as: 'path' | 'circle' | 'rect'
  /** Geometry attributes for that element */
  attrs: Record<string, string | number>
  /** Whether this is the mark's one solid accent rather than a stroked outline */
  solid?: true
}

/** A complete package mark, drawn back to front. */
export type PackageMark = readonly PackageMarkShape[]

/**
 * A stroked outline.
 *
 * @param d - SVG path data
 * @returns The shape
 */
export function line(d: string): PackageMarkShape {
  return { as: 'path', attrs: { d } }
}

/**
 * A stroked circle.
 *
 * @param cx - Centre x
 * @param cy - Centre y
 * @param r - Radius
 * @returns The shape
 */
export function ring(cx: number, cy: number, r: number): PackageMarkShape {
  return { as: 'circle', attrs: { cx, cy, r } }
}

/**
 * The mark's solid accent, as a filled circle.
 *
 * @param cx - Centre x
 * @param cy - Centre y
 * @param r - Radius
 * @returns The shape
 */
export function dot(cx: number, cy: number, r: number): PackageMarkShape {
  return { as: 'circle', attrs: { cx, cy, r }, solid: true }
}

/**
 * A stroked rounded rectangle.
 *
 * @param x - Left edge
 * @param y - Top edge
 * @param width - How far it runs across the grid
 * @param height - How far it runs down the grid
 * @param rx - Corner radius
 * @returns The shape
 */
export function box(x: number, y: number, width: number, height: number, rx: number): PackageMarkShape {
  return { as: 'rect', attrs: { x, y, width, height, rx } }
}

/**
 * The mark's solid accent, as a filled rounded rectangle.
 *
 * @param x - Left edge
 * @param y - Top edge
 * @param width - How far it runs across the grid
 * @param height - How far it runs down the grid
 * @param rx - Corner radius
 * @returns The shape
 */
export function slab(x: number, y: number, width: number, height: number, rx: number): PackageMarkShape {
  return { as: 'rect', attrs: { x, y, width, height, rx }, solid: true }
}

/**
 * A package mark's geometry, keyed by the npm package name it belongs to.
 *
 * The key is the package's registry name because that is the identifier every
 * other package-level surface already carries: the ecosystem model, the docs
 * manifest, and the guide corpus all address a package this way, so a mark is
 * looked up with the value a page already has rather than with a slug it would
 * have to map first.
 *
 * The geometry itself is read from the workspace's package identity file, which
 * the media recorder draws the same marks from for a package's banner; one file
 * is what keeps a package looking like itself on a card here and on npm. Adding
 * a package mark is one entry there. Nothing else changes: the icon component,
 * the library index, and the fallback all read this map.
 */
export const PACKAGE_MARKS: Record<string, PackageMark> = fromEntries(
  entries(identity.packages).map(([name, entry]) => [name, entry.mark as PackageMark])
)

/**
 * The mark shown for a package that has none of its own: the outline of a
 * package, which is the one thing every entry on the index is.
 *
 * It exists so a package added to the workspace before its mark is drawn still
 * renders an identity rather than a hole, and so no caller has to branch on
 * whether a mark exists.
 */
export const FALLBACK_MARK: PackageMark = identity.fallbackMark as PackageMark
