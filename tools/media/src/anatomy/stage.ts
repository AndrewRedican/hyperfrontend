import type { AnatomyConfig, AnatomyLayer } from '../models/anatomy'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { Point, Rect } from '../stage/geometry'
import { cos, PI, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { renderMarkAt } from '../banner/mark'
import { escapeHtml } from '../lib/escape-html'
import { BADGE_R, CHROME_H, renderBadge, renderBars, renderChrome, seamPartStyles } from '../seam/parts'
import { defineStage } from '../stage/define-stage'
import { figureMetrics, figureStyles, renderArrowhead } from '../stage/figure'

/** Where everything in the figure sits. */
interface AnatomyLayout {
  /** The host's window. */
  host: Rect
  /** The shell's outline inside the host. */
  shell: Rect
  /** The browsing-context boundary inside the shell. */
  boundary: Rect
  /** The hostee's window inside the boundary. */
  hostee: Rect
  /** Vertical position of the channel. */
  channelY: number
  /** Where the channel leaves the host's own content. */
  portX: number
  /** Centre of the cross-section. */
  centre: Point
  /** Radius of each ring, outermost first, index for index with the layers. */
  radii: readonly number[]
  /** Left edge of the layer labels. */
  labelX: number
  /** Vertical position of each layer label, index for index with the layers. */
  labelYs: readonly number[]
  /** Vertical position of the legend. */
  legendY: number
}

/** Where the legend has got to as it is laid out left to right. */
interface LegendCursor {
  /** Left edge of the next entry. */
  x: number
  /** The entries drawn so far. */
  markup: string
}

/** Radius of the innermost ring. */
const CORE_R = 22

/** How much wider each ring is than the one inside it. */
const RING_STEP = 18

/** Vertical distance between two layer labels. */
const LABEL_STEP = 36

/** Side of the mark beside a layer's name. */
const LAYER_MARK_PX = 14

/** Angles, clockwise from east, at which each ring's leader leaves it, outermost first. */
const LEADER_ANGLES: readonly number[] = [-52, -20, 12, 44]

/**
 * Lay the figure out for one profile.
 *
 * The host window takes the top of the frame, laid out exactly as the seam
 * figure lays it out. Under it, the cross-section sits directly below the
 * point where the channel leaves the host's content, so a dotted line can
 * join the two, and its layer labels run to the right. The legend runs
 * along the foot.
 *
 * @param profile - The presentation target being composed for.
 * @param count - How many layers the channel has.
 * @returns Every position the renderer needs.
 */
function anatomyLayout(profile: MediaProfile, count: number): AnatomyLayout {
  const inset = figureMetrics(profile).insetPx
  const host = { x: inset + 12, y: 56, w: profile.width - (inset + 12) * 2, h: 322 }
  const shell = { x: host.x + 270, y: host.y + 42, w: host.w - 270 - 16, h: host.h - 42 - 16 }
  const boundary = { x: shell.x + 18, y: shell.y + 30, w: shell.w - 36, h: shell.h - 46 }
  const hostee = { x: boundary.x + 16, y: boundary.y + 16, w: boundary.w - 32, h: boundary.h - 44 }
  const portX = host.x + 196
  const outerR = CORE_R + RING_STEP * (count - 1)
  const centre = { x: portX, y: host.y + host.h + 46 + outerR }
  const radii: number[] = []
  for (let index = 0; index < count; index += 1) {
    radii.push(outerR - RING_STEP * index)
  }
  const labelYs: number[] = []
  const firstLabelY = centre.y - (LABEL_STEP * (count - 1)) / 2
  for (let index = 0; index < count; index += 1) {
    labelYs.push(firstLabelY + LABEL_STEP * index)
  }
  return {
    host,
    shell,
    boundary,
    hostee,
    channelY: hostee.y + CHROME_H + 62,
    portX,
    centre,
    radii,
    labelX: centre.x + outerR + 44,
    labelYs,
    legendY: profile.height - 28,
  }
}

/**
 * Draw the channel between the host's content and the hostee, with a
 * message going each way.
 *
 * @param layout - Where everything sits.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the channel.
 */
function renderChannel(layout: AnatomyLayout, theme: MediaTheme): string {
  const y = layout.channelY
  const from = layout.portX
  const to = layout.hostee.x
  const midway = (from + to) / 2
  return `<line class="sm-wire" x1="${from}" y1="${y}" x2="${to}" y2="${y}"/>
    <circle cx="${from}" cy="${y}" r="5" fill="${theme.surfaceRaised}" stroke="${theme.accent}" stroke-width="1.8"/>
    <circle cx="${to}" cy="${y}" r="5" fill="${theme.surfaceRaised}" stroke="${theme.accent}" stroke-width="1.8"/>
    <g fill="${theme.accent}" stroke="${theme.accent}" stroke-width="1.6">
      <circle cx="${midway - 22}" cy="${y - 7}" r="3.5" stroke="none"/>${renderArrowhead(midway - 8, y - 7, 0, 4)}
      <line x1="${midway - 22}" y1="${y - 7}" x2="${midway - 8}" y2="${y - 7}"/>
      <circle cx="${midway + 22}" cy="${y + 7}" r="3.5" stroke="none"/>${renderArrowhead(midway + 8, y + 7, 180, 4)}
      <line x1="${midway + 22}" y1="${y + 7}" x2="${midway + 8}" y2="${y + 7}"/>
    </g>`
}

/**
 * Draw the cross-section of the channel: one ring per layer, a leader from
 * each ring to its label, and the label itself.
 *
 * The outermost ring is the layer a host touches and the core is the
 * cryptography everything rests on, so the rings read inward the way the
 * stack reads downward. Leaders leave the rings at angles that increase
 * with the label rows, which is what keeps them from crossing.
 *
 * @param layout - Where everything sits.
 * @param layers - The layers, outermost first.
 * @param theme - The visual tokens this variant is drawn with.
 * @param monoPx - Font size of a layer's name.
 * @returns SVG markup for the cross-section.
 */
function renderSection(layout: AnatomyLayout, layers: readonly AnatomyLayer[], theme: MediaTheme, monoPx: number): string {
  const { centre } = layout
  const rings = layout.radii
    .map((radius, index) => {
      const core = index === layers.length - 1
      const opacity = core ? 1 : 0.35 + (0.5 * index) / layers.length
      return `<circle cx="${centre.x}" cy="${centre.y}" r="${radius}" fill="${core ? theme.accent : theme.accentSoft}" fill-opacity="${opacity.toFixed(2)}" stroke="${theme.border}" stroke-width="1.4"/>`
    })
    .join('')
  const labels = layers
    .map((layer, index) => {
      const radius = layout.radii[index] ?? CORE_R
      const angle = ((LEADER_ANGLES[index] ?? 0) * PI) / 180
      const start = { x: centre.x + radius * cos(angle), y: centre.y + radius * sin(angle) }
      const y = layout.labelYs[index] ?? centre.y
      const nameX = layout.labelX + LAYER_MARK_PX + 8
      const noteX = nameX + layer.name.length * monoPx * 0.62 + 12
      return `<line x1="${start.x.toFixed(1)}" y1="${start.y.toFixed(1)}" x2="${layout.labelX - 10}" y2="${y}" stroke="${theme.text.muted}" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="${start.x.toFixed(1)}" cy="${start.y.toFixed(1)}" r="2.6" fill="${theme.text.muted}"/>
        ${renderMarkAt(layer.mark, layout.labelX + LAYER_MARK_PX / 2, y, LAYER_MARK_PX, theme.accent)}
        <text class="fig-mono fig-mono--accent" x="${nameX}" y="${y + 4}">${escapeHtml(layer.name)}</text>
        <text class="fig-note" x="${noteX.toFixed(1)}" y="${y + 4}">${escapeHtml(layer.note)}</text>`
    })
    .join('')
  const top = centre.y - (layout.radii[0] ?? CORE_R)
  const connector = `<line x1="${layout.portX}" y1="${layout.channelY + 8}" x2="${layout.portX}" y2="${top - 6}" stroke="${theme.text.muted}" stroke-width="1.4" stroke-dasharray="2 5" stroke-linecap="round"/>`
  return `${connector}${rings}${labels}`
}

/**
 * Build the stylesheet for the figure, with its theme resolved into it.
 *
 * @param config - The figure as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this figure.
 */
function anatomyStyles(config: AnatomyConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = figureMetrics(profile)
  return `
${figureStyles(theme, metrics)}
${seamPartStyles(theme, metrics)}
`
}

/**
 * A host, the shell it loads a feature through, the hostee inside the
 * boundary the shell draws, and what the channel between them is made of.
 *
 * The top of the figure is the seam: host and hostee nested exactly as they
 * are at run time, each with its own origin, the channel crossing the
 * boundary with a message going each way, and four badges numbering the
 * four ideas the legend names. The bottom exposes the channel: a dotted
 * line drops from the wire to a cross-section whose rings are the packages
 * the channel runs on, outermost at the host's fingertips and the
 * cryptography at the core.
 */
export const anatomyStage: Stage<AnatomyConfig> = defineStage<AnatomyConfig>({
  id: 'anatomy',

  styles: anatomyStyles,

  durationMs(): number {
    return 0
  },

  frame({ config, profile, theme }): string {
    const metrics = figureMetrics(profile)
    const layout = anatomyLayout(profile, config.layers.length)
    const { host, shell, boundary, hostee } = layout
    const tabW = config.shellLabel.length * metrics.monoPx * 0.6 + 44
    const legend = config.annotations
      .map((label, index) => ({ index, text: label, width: label.length * (metrics.notePx + 0.5) * 0.52 + BADGE_R * 2 + 12 }))
      .reduce<LegendCursor>(
        (acc, entry) => ({
          x: acc.x + entry.width + 34,
          markup: `${acc.markup}${renderBadge(acc.x + BADGE_R, layout.legendY, entry.index + 1, theme)}<text class="sm-legend" x="${acc.x + BADGE_R * 2 + 8}" y="${layout.legendY + 4}">${escapeHtml(entry.text)}</text>`,
        }),
        { x: host.x, markup: '' }
      ).markup
    return `<div class="fig-frame">
      <svg class="fig-svg" viewBox="0 0 ${profile.width} ${profile.height}" width="${profile.width}" height="${profile.height}" aria-hidden="true">
        <text class="fig-caps" x="${host.x}" y="${host.y - 14}">${escapeHtml(config.hostCaption)}</text>
        <rect class="sm-window" x="${host.x}" y="${host.y}" width="${host.w}" height="${host.h}" rx="10"/>
        ${renderChrome(host, config.hostOrigin, theme, '')}
        ${renderBars(host.x + 22, host.y + CHROME_H + 26, [150, 210, 180, 200, 120], 'sm-bar')}
        ${renderBars(host.x + 22, host.y + CHROME_H + 156, [110, 150, 130], 'sm-bar')}
        <rect class="sm-shell" x="${shell.x}" y="${shell.y}" width="${shell.w}" height="${shell.h}" rx="12"/>
        <rect class="sm-tab" x="${shell.x + 14}" y="${shell.y - 13}" width="${tabW.toFixed(1)}" height="26" rx="13"/>
        ${renderMarkAt(config.shellMark, shell.x + 14 + 16, shell.y, 15, theme.accent)}
        <text class="sm-tab-label" x="${shell.x + 14 + 28}" y="${shell.y + 4}">${escapeHtml(config.shellLabel)}</text>
        ${renderBadge(shell.x + 14 + tabW + 14, shell.y, 1, theme)}
        <rect class="sm-boundary" x="${boundary.x}" y="${boundary.y}" width="${boundary.w}" height="${boundary.h}" rx="10"/>
        <text class="fig-caps" x="${boundary.x + boundary.w - 16}" y="${boundary.y + boundary.h - 9}" text-anchor="end">${escapeHtml(config.boundaryCaption)}</text>
        ${renderBadge(boundary.x + boundary.w, boundary.y, 2, theme)}
        <rect class="sm-window sm-window--hostee" x="${hostee.x}" y="${hostee.y}" width="${hostee.w}" height="${hostee.h}" rx="10"/>
        ${renderChrome(hostee, config.hosteeOrigin, theme, renderBadge(hostee.x + 62 + config.hosteeOrigin.length * 7.2 + 24 + 16, hostee.y + CHROME_H / 2, 4, theme))}
        <text class="fig-caps" x="${hostee.x + 18}" y="${hostee.y + CHROME_H + 26}">${escapeHtml(config.hosteeCaption)}</text>
        ${renderBars(hostee.x + 18, hostee.y + CHROME_H + 42, [140, 220, 190, 160], 'sm-bar sm-bar--hostee')}
        ${renderChannel(layout, theme)}
        ${renderBadge((layout.portX + hostee.x) / 2, layout.channelY - 26, 3, theme)}
        <text class="fig-note" x="${(layout.portX + hostee.x) / 2}" y="${layout.channelY + 30}" text-anchor="middle">${escapeHtml(config.channelLabel)}</text>
        ${renderSection(layout, config.layers, theme, metrics.monoPx)}
        ${legend}
      </svg>
    </div>`
  },
})
