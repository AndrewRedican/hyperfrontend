import type { Mark } from './banner'

/** The glyphs a surface can be marked with. */
export type SurfaceGlyph = 'reference' | 'book' | 'checklist' | 'bulb' | 'tag' | 'cube' | 'document' | 'film'

/** One surface the source is projected onto. */
export interface ProjectionSurface {
  /** The surface's name. */
  label: string
  /** The glyph beside the name. */
  glyph: SurfaceGlyph
}

/** Everything a scene tells the projections stage. */
export interface ProjectionsConfig {
  /** The name of the source at the centre. */
  source: string
  /** The line under that name. */
  sourceNote: string
  /** The mark drawn in the source. */
  mark: Mark
  /** The surfaces, clockwise from the top. */
  surfaces: readonly ProjectionSurface[]
  /** The line along the foot of the figure. */
  caption: string
}
