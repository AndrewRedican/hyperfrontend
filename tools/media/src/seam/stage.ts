import type { MediaProfile } from '../models/profile'
import type { SeamConfig } from '../models/seam'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { Rect } from '../stage/geometry'
import { renderMarkAt } from '../banner/mark'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { figureMetrics, figureStyles, renderArrowhead } from '../stage/figure'

/** Where everything in the figure sits. */
interface SeamLayout {
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

/** Height of a window's chrome bar. */
const CHROME_H = 30

/** Radius of a numbered badge. */
const BADGE_R = 9

/**
 * Lay the figure out for one profile.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every position the renderer needs.
 */
function seamLayout(profile: MediaProfile): SeamLayout {
  const inset = figureMetrics(profile).insetPx
  const host = { x: inset + 12, y: 64, w: profile.width - (inset + 12) * 2, h: profile.height - 64 - 66 }
  const shell = { x: host.x + 298, y: host.y + 46, w: host.w - 298 - 16, h: host.h - 46 - 16 }
  const boundary = { x: shell.x + 18, y: shell.y + 30, w: shell.w - 36, h: shell.h - 46 }
  const hostee = { x: boundary.x + 16, y: boundary.y + 16, w: boundary.w - 32, h: boundary.h - 44 }
  return {
    host,
    shell,
    boundary,
    hostee,
    channelY: hostee.y + CHROME_H + 62,
    portX: host.x + 206,
    legendY: profile.height - 30,
  }
}

/**
 * Draw a window's chrome: three buttons and an address pill.
 *
 * @param rect - The window.
 * @param origin - What the address bar says.
 * @param theme - The visual tokens this variant is drawn with.
 * @param badge - A badge drawn at the end of the address pill, or nothing.
 * @returns SVG markup for the chrome.
 */
function renderChrome(rect: Rect, origin: string, theme: MediaTheme, badge: string): string {
  const dots = theme.chrome.buttons
    .map((colour, index) => `<circle cx="${rect.x + 16 + index * 13}" cy="${rect.y + CHROME_H / 2}" r="4" fill="${colour}"/>`)
    .join('')
  const pillX = rect.x + 62
  const pillW = origin.length * 7.2 + 24
  return `<path d="M ${rect.x} ${rect.y + CHROME_H} V ${rect.y + 10} a 10 10 0 0 1 10 -10 H ${rect.x + rect.w - 10} a 10 10 0 0 1 10 10 V ${rect.y + CHROME_H} Z" class="sm-chrome"/>
    <line class="fig-rule" x1="${rect.x}" y1="${rect.y + CHROME_H}" x2="${rect.x + rect.w}" y2="${rect.y + CHROME_H}"/>${dots}
    <rect class="sm-pill" x="${pillX}" y="${rect.y + 7}" width="${pillW.toFixed(1)}" height="${CHROME_H - 14}" rx="8"/>
    <text class="fig-mono" x="${pillX + 12}" y="${rect.y + CHROME_H / 2 + 4}">${escapeHtml(origin)}</text>${badge}`
}

/**
 * Draw a numbered badge.
 *
 * @param x - Horizontal centre.
 * @param y - Vertical centre.
 * @param number - The number inside it.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the badge.
 */
function renderBadge(x: number, y: number, number: number, theme: MediaTheme): string {
  return `<circle cx="${x}" cy="${y}" r="${BADGE_R}" fill="${theme.accent}"/><text class="sm-badge" x="${x}" y="${y + 3.5}" text-anchor="middle">${number}</text>`
}

/**
 * Draw placeholder content: a headline bar and lines under it.
 *
 * @param x - Left edge.
 * @param y - Top edge.
 * @param widths - Width of each line, the first drawn as a headline.
 * @param className - Class the bars carry.
 * @returns SVG markup for the bars.
 */
function renderBars(x: number, y: number, widths: readonly number[], className: string): string {
  return widths
    .map((width, index) => {
      const height = index === 0 ? 14 : 8
      const top = index === 0 ? y : y + 26 + (index - 1) * 18
      return `<rect class="${className}" x="${x}" y="${top}" width="${width}" height="${height}" rx="${height / 2}"/>`
    })
    .join('')
}

/**
 * Draw the channel between the host's content and the hostee, with a
 * message going each way.
 *
 * @param layout - Where everything sits.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the channel.
 */
function renderChannel(layout: SeamLayout, theme: MediaTheme): string {
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
 * Build the stylesheet for the figure, with its theme resolved into it.
 *
 * @param config - The figure as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this figure.
 */
function seamStyles(config: SeamConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = figureMetrics(profile)
  return `
${figureStyles(theme, metrics)}
.sm-window { fill: ${theme.surface}; stroke: ${theme.border}; stroke-width: 1.4; }
.sm-window--hostee { fill: ${theme.surfaceRaised}; }
.sm-chrome { fill: ${theme.chrome.bar}; }
.sm-pill { fill: ${theme.surface}; stroke: ${theme.rule}; stroke-width: 1; }
.sm-bar { fill: ${theme.rule}; }
.sm-bar--hostee { fill: ${theme.accentSoft}; }
.sm-shell { fill: none; stroke: ${theme.accent}; stroke-width: 1.8; }
.sm-tab { fill: ${theme.surfaceRaised}; stroke: ${theme.accent}; stroke-width: 1.8; }
.sm-tab-label { font-family: ${theme.fonts.mono}; font-size: ${metrics.monoPx}px; font-weight: 600; fill: ${theme.tones.accent}; }
.sm-boundary { fill: none; stroke: ${theme.text.muted}; stroke-width: 1.8; stroke-dasharray: 6 5; }
.sm-wire { stroke: ${theme.accent}; stroke-width: 2; stroke-linecap: round; }
.sm-badge { font-family: ${theme.fonts.mono}; font-size: ${metrics.notePx}px; font-weight: 700; fill: ${theme.transparent ? theme.plate : '#ffffff'}; }
.sm-legend { font-size: ${metrics.notePx + 0.5}px; font-weight: 600; fill: ${theme.text.plain}; }
`
}

/**
 * A host application, the shell it loads a feature through, and the hostee
 * application running inside the boundary the shell draws.
 *
 * The three are nested because that is where they are: the shell is the
 * host's own package, the boundary is the browsing context it opens, and
 * the hostee is the other team's application seated inside it, with its own
 * origin in its own address bar. The channel crosses all of that with a
 * message going each way. Four badges number the four ideas the article
 * asks the figure to carry, and the legend under the window names them.
 */
export const seamStage: Stage<SeamConfig> = defineStage<SeamConfig>({
  id: 'seam',

  styles: seamStyles,

  durationMs(): number {
    return 0
  },

  frame({ config, profile, theme }): string {
    const metrics = figureMetrics(profile)
    const layout = seamLayout(profile)
    const { host, shell, boundary, hostee } = layout
    const tabW = config.shellLabel.length * metrics.monoPx * 0.6 + 44
    const legend = config.annotations
      .map((annotation, index) => ({
        index,
        text: annotation.label,
        width: annotation.label.length * (metrics.notePx + 0.5) * 0.52 + BADGE_R * 2 + 12,
      }))
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
        ${renderBars(host.x + 22, host.y + CHROME_H + 156, [110, 170, 140], 'sm-bar')}
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
        ${legend}
      </svg>
    </div>`
  },
})
