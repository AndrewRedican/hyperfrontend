/** One drawn element of an identity mark. */
export interface MarkShape {
  /** SVG element to draw. */
  as: 'path' | 'circle' | 'rect'
  /** Geometry attributes for that element. */
  attrs: Record<string, string | number>
  /** Whether this is the mark's one solid accent rather than a stroked outline. */
  solid?: boolean
}

/**
 * An identity mark: stroked outlines and at most one solid accent, drawn on a
 * 32 unit grid with a four unit margin.
 */
export type Mark = readonly MarkShape[]

/** Everything a scene tells the banner stage. */
export interface BannerConfig {
  /** The part of the name before the package itself, such as a scope, set quietly above it. */
  prefix: string
  /** The package's own name, set large. */
  name: string
  /** One line saying what the package is for. */
  tagline: string
  /** The package's mark. */
  mark: Mark
  /** Short facts set as pills under the tagline, such as the runtimes it supports. */
  facets: readonly string[]
  /**
   * How long one drift of the ground takes before it is back where it began.
   *
   * The banner's one motion is the light behind the tile, and it moves on a
   * closed path so the animation joins itself: the frame drawn at this offset
   * is the frame drawn at zero.
   */
  loopMs: number
}
