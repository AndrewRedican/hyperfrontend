import type { EcosystemConfig, EcosystemEdge } from '../models/ecosystem'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { ChipBox, ClusterBox, EcosystemLayout } from './layout'
import { abs } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { renderMarkAt } from '../banner/mark'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { figureMetrics, figureStyles, renderArrowhead } from '../stage/figure'
import { ecosystemLayout, findChip } from './layout'

/**
 * Draw one chip: its outline, its mark, its name, and the need under it.
 *
 * @param box - The placed chip.
 * @param layout - Where everything sits.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the chip.
 */
function renderChip(box: ChipBox, layout: EcosystemLayout, theme: MediaTheme): string {
  const markPx = box.large ? layout.markPx + 6 : layout.markPx
  const fontPx = box.large ? layout.hubPx : layout.chipPx
  const left = box.x - box.w / 2
  const halo = box.large
    ? `<rect x="${(left - 8).toFixed(1)}" y="${(box.y - box.h / 2 - 8).toFixed(1)}" width="${box.w + 16}" height="${box.h + 16}" rx="14" fill="${theme.accentSoft}"/>`
    : ''
  const note =
    box.chip.note === undefined
      ? ''
      : `<text class="fig-note" x="${box.x.toFixed(1)}" y="${(box.y + box.h / 2 + 14).toFixed(1)}" text-anchor="middle">${escapeHtml(box.chip.note)}</text>`
  return `${halo}<rect class="ec-chip${box.large ? ' ec-chip--hub' : ''}" x="${left.toFixed(1)}" y="${(box.y - box.h / 2).toFixed(1)}" width="${box.w}" height="${box.h}" rx="${box.large ? 10 : 8}"/>
    ${renderMarkAt(box.chip.mark, left + 10 + markPx / 2, box.y, markPx, theme.accent)}
    <text class="ec-name${box.large ? ' ec-name--hub' : ''}" x="${(left + 10 + markPx + 6).toFixed(1)}" y="${(box.y + fontPx * 0.36).toFixed(1)}" style="font-size:${fontPx}px">${escapeHtml(box.chip.name)}</text>${note}`
}

/**
 * Draw a cluster: its outline, its caption, and its chips.
 *
 * @param cluster - The placed cluster.
 * @param layout - Where everything sits.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the cluster.
 */
function renderCluster(cluster: ClusterBox, layout: EcosystemLayout, theme: MediaTheme): string {
  const { rect } = cluster
  return `<rect class="ec-cluster" x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="14"/>
    <text class="fig-caps" x="${rect.x + 18}" y="${rect.y + 24}">${escapeHtml(cluster.caption)}</text>
    ${cluster.chips.map((box) => renderChip(box, layout, theme)).join('')}`
}

/**
 * Draw one arrow between two chips, leaving and arriving by the sides that
 * face each other.
 *
 * A chip straight under another is joined top to bottom by a straight line;
 * anything else leaves by the facing side and arrives by the facing side on
 * a curve with level tangents, so the arrow reads as a connection between two
 * things rather than a line that happens to cross them.
 *
 * @param edge - The arrow as the scene named it.
 * @param layout - Where everything sits.
 * @returns SVG markup for the arrow, or nothing when either end is unplaced.
 */
function renderEdge(edge: EcosystemEdge, layout: EcosystemLayout): string {
  const from = findChip(layout, edge.from)
  const to = findChip(layout, edge.to)
  if (from === undefined || to === undefined) {
    return ''
  }
  if (abs(from.x - to.x) < 1) {
    const startY = from.y + from.h / 2 + 8
    const endY = to.y - to.h / 2 - 8
    return `<g class="fig-edge fig-edge--accent"><line x1="${from.x}" y1="${startY.toFixed(1)}" x2="${to.x}" y2="${endY.toFixed(1)}"/>${renderArrowhead(to.x, endY, 90, 6)}</g>`
  }
  const rightward = to.x > from.x
  const start = { x: rightward ? from.x + from.w / 2 + 6 : from.x - from.w / 2 - 6, y: from.y }
  const end = { x: rightward ? to.x - to.w / 2 - 8 : to.x + to.w / 2 + 8, y: to.y }
  const reach = (end.x - start.x) * 0.5
  const d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${(start.x + reach).toFixed(1)} ${start.y.toFixed(1)}, ${(end.x - reach).toFixed(1)} ${end.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
  return `<g class="fig-edge fig-edge--accent"><path d="${d}"/>${renderArrowhead(end.x, end.y, rightward ? 0 : 180, 6)}</g>`
}

/**
 * Build the stylesheet for the figure, with its theme resolved into it.
 *
 * @param config - The ecosystem as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this figure.
 */
function ecosystemStyles(config: EcosystemConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = figureMetrics(profile)
  return `
${figureStyles(theme, metrics)}
.ec-chip { fill: ${theme.surfaceRaised}; stroke: ${theme.border}; stroke-width: 1.2; }
.ec-chip--hub { stroke: ${theme.accent}; stroke-width: 1.8; }
.ec-name { font-family: ${theme.fonts.mono}; font-weight: 600; fill: ${theme.text.strong}; }
.ec-name--hub { fill: ${theme.tones.accent}; }
.ec-cluster { fill: none; stroke: ${theme.rule}; stroke-width: 1.2; stroke-dasharray: 5 4; }
.fig-edge--accent { opacity: 0.85; }
`
}

/**
 * The published packages, grouped by the kind of need that produced them.
 *
 * The flagship sits at the top centre with the two communication packages
 * hanging under it; the primitives and the tooling flank that spine; the
 * utilities run along the foot as the layer everything else rests on. A few
 * arrows carry the story the article tells, from a need to the package it
 * produced. The full dependency graph is deliberately absent: the figure is
 * about why there are nineteen, not which imports which.
 */
export const ecosystemStage: Stage<EcosystemConfig> = defineStage<EcosystemConfig>({
  id: 'ecosystem',

  styles: ecosystemStyles,

  durationMs(): number {
    return 0
  },

  frame({ config, profile, theme }): string {
    const metrics = figureMetrics(profile)
    const layout = ecosystemLayout(config, profile)
    const edges = config.edges.map((edge) => renderEdge(edge, layout)).join('')
    const caption =
      config.caption === ''
        ? ''
        : `<text class="fig-caps" x="${metrics.insetPx}" y="${metrics.insetPx + 20}">${escapeHtml(config.caption)}</text>`
    const note =
      config.note === ''
        ? ''
        : `<text class="fig-plain" x="${metrics.insetPx}" y="${metrics.insetPx + 40}">${escapeHtml(config.note)}</text>`
    const stamp =
      config.stamp === ''
        ? ''
        : `<text class="fig-mono" x="${profile.width - metrics.insetPx}" y="${metrics.insetPx + 20}" text-anchor="end">${escapeHtml(config.stamp)}</text>`
    return `<div class="fig-frame">
      <svg class="fig-svg" viewBox="0 0 ${profile.width} ${profile.height}" width="${profile.width}" height="${profile.height}" aria-hidden="true">
        ${caption}
        ${note}
        ${stamp}
        ${renderCluster(layout.left, layout, theme)}
        ${renderCluster(layout.right, layout, theme)}
        ${renderCluster(layout.foot, layout, theme)}
        ${edges}
        ${renderChip(layout.hub, layout, theme)}
        ${layout.spine.map((box) => renderChip(box, layout, theme)).join('')}
        <text class="fig-caps" x="${layout.hub.x}" y="${layout.spineCaptionY}" text-anchor="middle">${escapeHtml(config.spineCaption)}</text>
      </svg>
    </div>`
  },
})
