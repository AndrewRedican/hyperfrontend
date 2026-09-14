import type { PackageMark } from './package-marks'
import { createElement } from 'react'
import { FALLBACK_MARK, PACKAGE_MARKS } from './package-marks'

/** Props for {@link PackageIcon}. */
export interface PackageIconProps {
  /** npm package name the mark belongs to */
  packageName: string
  /** Sizing and colour classes; the mark fills whatever box these give it */
  className?: string
  /**
   * What a screen reader should call the mark. Omitted, the mark is decorative
   * and hidden, which is right wherever the package is already named in text
   * beside it.
   */
  label?: string
}

/**
 * The drawing surface every package mark shares.
 *
 * A 32 unit square with a four unit margin, so a mark reads the same at any
 * size and two marks placed side by side agree on their optical weight. Every
 * glyph is stroked rather than filled, in one weight, with round joins.
 */
const ICON_VIEW_BOX = '0 0 32 32'

/** Stroke weight the whole family is drawn in, in view box units. */
const ICON_STROKE_WIDTH = 2

/** How the one solid element a mark is allowed differs from the stroked ones. */
const SOLID_ATTRS = { fill: 'currentColor', stroke: 'none' } as const

/** Props for {@link MarkGlyph}. */
export interface MarkGlyphProps {
  /** The geometry to draw */
  mark: PackageMark
  /** Sizing and colour classes; the mark fills whatever box these give it */
  className?: string
  /** What a screen reader should call the mark, omitted when decorative */
  label?: string
}

/**
 * One package's mark.
 *
 * Colour is never set here. The geometry inherits `currentColor` for both its
 * strokes and its solid accent, so a mark takes the colour of whatever it is
 * placed in and is correct in both themes without a second asset, a media
 * query, or client-side theme detection. Size is a class the caller gives it,
 * and the aspect ratio is square by construction.
 * @param props - See {@link PackageIconProps}.
 * @param props.packageName - npm package name the mark belongs to
 * @param props.className - Sizing and colour classes
 * @param props.label - What a screen reader should call the mark, omitted when decorative
 * @returns The mark, or the generic package outline for a package with none of its own.
 * @example Ambient identity behind a card
 * ```tsx
 * <PackageIcon packageName="@hyperfrontend/nexus" className="h-32 w-32 text-slate-400" />
 * ```
 */
export function PackageIcon({ packageName, className = 'h-6 w-6', label }: PackageIconProps) {
  return <MarkGlyph mark={PACKAGE_MARKS[packageName] ?? FALLBACK_MARK} className={className} label={label} />
}

/**
 * Any mark drawn in the family's grid, stroke and joins.
 *
 * The package icon is one caller; a concept that wants an identity in the same
 * hand, without being a package, is another. Both go through here so the
 * drawing surface is stated once.
 * @param props - See {@link MarkGlyphProps}.
 * @param props.mark - The geometry to draw
 * @param props.className - Sizing and colour classes
 * @param props.label - What a screen reader should call the mark, omitted when decorative
 * @returns The mark.
 */
export function MarkGlyph({ mark, className = 'h-6 w-6', label }: MarkGlyphProps) {
  return (
    <svg
      viewBox={ICON_VIEW_BOX}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {mark.map((shape, index) => createElement(shape.as, { key: index, ...shape.attrs, ...(shape.solid ? SOLID_ATTRS : {}) }))}
    </svg>
  )
}
