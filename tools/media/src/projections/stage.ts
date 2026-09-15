import type { MediaProfile } from '../models/profile'
import type { ProjectionsConfig } from '../models/projections'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { Point } from '../stage/geometry'
import { abs, cos, PI, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { renderMarkAt } from '../banner/mark'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { figureMetrics, figureStyles } from '../stage/figure'
import { renderSurfaceGlyph } from './glyphs'

/** Radius of the source at the centre. */
const SOURCE_R = 64

/** Width of a surface's card. */
const CARD_W = 158

/** Height of a surface's card. */
const CARD_H = 44

/** A surface placed on the ring. */
interface PlacedSurface {
  /** Horizontal centre of its card. */
  x: number
  /** Vertical centre of its card. */
  y: number
  /** The two corners of the card that face the source, for the cone. */
  near: readonly [Point, Point]
}

/**
 * Place the surfaces evenly round an ellipse, the first at the top.
 *
 * @param count - How many surfaces.
 * @param centre - The source's centre.
 * @param rx - Horizontal radius of the ring.
 * @param ry - Vertical radius of the ring.
 * @returns Each surface's card and the corners its cone lands on.
 */
function placeSurfaces(count: number, centre: Point, rx: number, ry: number): readonly PlacedSurface[] {
  const placed: PlacedSurface[] = []
  for (let index = 0; index < count; index += 1) {
    const angle = -PI / 2 + (index / count) * 2 * PI
    const x = centre.x + rx * cos(angle)
    const y = centre.y + ry * sin(angle)
    const left = x - CARD_W / 2
    const top = y - CARD_H / 2
    // why: the cone lands on the side of the card that faces the source: the bottom edge of a card above it, the top of one below, and the inner edge of one beside it
    const dx = x - centre.x
    const dy = y - centre.y
    const near: readonly [Point, Point] =
      abs(dy) > abs(dx) * 1.6
        ? dy < 0
          ? [
              { x: left, y: top + CARD_H },
              { x: left + CARD_W, y: top + CARD_H },
            ]
          : [
              { x: left, y: top },
              { x: left + CARD_W, y: top },
            ]
        : dx < 0
          ? [
              { x: left + CARD_W, y: top },
              { x: left + CARD_W, y: top + CARD_H },
            ]
          : [
              { x: left, y: top },
              { x: left, y: top + CARD_H },
            ]
    placed.push({ x, y, near })
  }
  return placed
}

/**
 * Build the stylesheet for the figure, with its theme resolved into it.
 *
 * @param config - The figure as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this figure.
 */
function projectionsStyles(config: ProjectionsConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = figureMetrics(profile)
  return `
${figureStyles(theme, metrics)}
.pj-cone { fill: ${theme.accent}; opacity: 0.09; }
.pj-ray { stroke: ${theme.accent}; stroke-width: 1.2; opacity: 0.5; }
.pj-source { fill: ${theme.surfaceRaised}; stroke: ${theme.accent}; stroke-width: 2; }
.pj-halo { fill: ${theme.accentSoft}; }
.pj-card { fill: ${theme.surface}; stroke: ${theme.border}; stroke-width: 1.2; }
`
}

/**
 * One source projected onto every surface the documentation takes.
 *
 * The centre is the repository and what it knows; round it, on one ring,
 * are the forms that knowledge is published in. Each is joined to the
 * centre by a cone of light rather than an arrow, because the point is not
 * that one thing leads to another but that they are all views of the same
 * thing, thrown in different directions.
 */
export const projectionsStage: Stage<ProjectionsConfig> = defineStage<ProjectionsConfig>({
  id: 'projections',

  styles: projectionsStyles,

  durationMs(): number {
    return 0
  },

  frame({ config, profile, theme }): string {
    const metrics = figureMetrics(profile)
    const centre = { x: profile.width / 2, y: (profile.height - 30) / 2 }
    const placed = placeSurfaces(
      config.surfaces.length,
      centre,
      profile.width / 2 - metrics.insetPx - CARD_W / 2 - 8,
      centre.y - metrics.insetPx - CARD_H / 2 - 8
    )
    const cones = placed
      .map(
        (surface) =>
          `<polygon class="pj-cone" points="${centre.x},${centre.y} ${surface.near[0].x.toFixed(1)},${surface.near[0].y.toFixed(1)} ${surface.near[1].x.toFixed(1)},${surface.near[1].y.toFixed(1)}"/><line class="pj-ray" x1="${centre.x}" y1="${centre.y}" x2="${surface.x.toFixed(1)}" y2="${surface.y.toFixed(1)}"/>`
      )
      .join('')
    const cards = placed
      .map((surface, index) => {
        const item = config.surfaces[index]
        if (item === undefined) {
          return ''
        }
        const left = surface.x - CARD_W / 2
        return `<rect class="pj-card" x="${left.toFixed(1)}" y="${(surface.y - CARD_H / 2).toFixed(1)}" width="${CARD_W}" height="${CARD_H}" rx="10"/>
          ${renderSurfaceGlyph(item.glyph, left + 24, surface.y, theme.accent)}
          <text class="fig-label" x="${(left + 44).toFixed(1)}" y="${(surface.y + 5).toFixed(1)}">${escapeHtml(item.label)}</text>`
      })
      .join('')
    return `<div class="fig-frame">
      <svg class="fig-svg" viewBox="0 0 ${profile.width} ${profile.height}" width="${profile.width}" height="${profile.height}" aria-hidden="true">
        ${cones}
        <circle class="pj-halo" cx="${centre.x}" cy="${centre.y}" r="${SOURCE_R + 12}"/>
        <circle class="pj-source" cx="${centre.x}" cy="${centre.y}" r="${SOURCE_R}"/>
        ${renderMarkAt(config.mark, centre.x, centre.y - 20, 30, theme.accent)}
        <text class="fig-label" x="${centre.x}" y="${centre.y + 16}" text-anchor="middle">${escapeHtml(config.source)}</text>
        <text class="fig-note" x="${centre.x}" y="${centre.y + 33}" text-anchor="middle">${escapeHtml(config.sourceNote)}</text>
        ${cards}
        <text class="fig-caption" x="${profile.width / 2}" y="${profile.height - metrics.insetPx + 10}" text-anchor="middle">${escapeHtml(config.caption)}</text>
      </svg>
    </div>`
  },
})
