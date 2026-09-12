import type { Panel, PanelConfig, PanelRow, PanelTone } from '../models/panel'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { ceil, floor, max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { highlight } from './syntax'

/** Every tone a theme colours, in the order the stylesheet declares them. */
const TONES: readonly PanelTone[] = ['plain', 'muted', 'accent', 'success', 'warning', 'danger']

/** Width past which the frame is drawn at its full density. */
const WIDE_ENOUGH = 800

/** How long the closing caption takes to arrive after the last row. */
const CAPTION_DELAY_MS = 260

/** How the frame is sized for the surface it is being drawn for. */
interface PanelMetrics {
  /** Font size of a row. */
  fontSizePx: number
  /** Line height of a row. */
  lineHeightPx: number
  /** Margin between the panels and the edge of the frame. */
  insetPx: number
  /** Padding inside a panel. */
  padPx: number
  /** Gap between panels. */
  gapPx: number
  /** Corner radius of a panel. */
  radiusPx: number
  /** Font size of a panel's title. */
  titlePx: number
  /** Font size of the heading over the panels. */
  headingPx: number
  /** Font size of the caption under them. */
  captionPx: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * The two profiles are two surfaces rather than one at two magnifications: the
 * compact one is expected to be handed fewer, shorter rows, because a phone
 * that has to be pinched is a phone that has been handed the desktop
 * composition. Its type is held at a size that survives being read on npm at
 * exactly the width it was drawn, which is the whole reason the compact
 * profile is that width.
 *
 * Both sit smaller than the terminal stage's type at the same profile, and
 * deliberately: a terminal is one column and this is two or four, so a line
 * here has a third of the width and wrapping is what a generous size buys.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
function panelMetrics(profile: MediaProfile): PanelMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  return {
    fontSizePx: wide ? 13 : 11.5,
    lineHeightPx: wide ? 22 : 18.5,
    insetPx: wide ? 28 : 18,
    padPx: wide ? 16 : 12,
    gapPx: wide ? 16 : 12,
    radiusPx: wide ? 12 : 10,
    titlePx: wide ? 12 : 11,
    headingPx: wide ? 15 : 14,
    captionPx: wide ? 14 : 12.5,
  }
}

/**
 * How many rows fit in a column, for a column that keeps only its newest.
 *
 * Worked out from the same measurements the stylesheet is built from, and
 * rounded down, so a tape never keeps a row the panel would clip.
 *
 * @param config - The frame as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @returns A row count of at least one.
 */
function rowCapacity(config: PanelConfig, profile: MediaProfile): number {
  const metrics = panelMetrics(profile)
  const chrome =
    (config.heading === undefined ? 0 : ceil(metrics.headingPx * 1.3) + metrics.gapPx) +
    (config.caption === undefined ? 0 : ceil(metrics.captionPx * 1.3) + metrics.gapPx)
  const title = metrics.titlePx * 1.3 + (metrics.padPx - 4) + (metrics.padPx - 6) + 1
  const inner = profile.height - metrics.insetPx * 2 - chrome - metrics.padPx * 2 - title
  return max(1, floor(inner / metrics.lineHeightPx))
}

/**
 * Order a panel's rows by the moment they arrive.
 *
 * @param panel - One column of the frame.
 * @returns The rows, earliest first.
 */
function ordered(panel: Panel): readonly PanelRow[] {
  return [...panel.rows].sort((left, right) => left.atMs - right.atMs)
}

/**
 * When the last row of the frame has finished arriving.
 *
 * @param config - The frame as the scene configured it.
 * @returns The offset at which nothing is still coming in.
 */
function settledAt(config: PanelConfig): number {
  let latest = 0
  for (const panel of config.panels) {
    for (const row of panel.rows) {
      latest = max(latest, row.atMs + (row.typeMs ?? 0))
    }
  }
  return latest
}

/**
 * Draw one row at one instant.
 *
 * A row that is still typing is cut to the characters it has reached and given
 * a caret; a row that has arrived whole is drawn whole. The cut is taken before
 * the tokeniser runs rather than after, so a half-typed string literal colours
 * as far as it has been typed instead of flickering when the closing quote
 * lands.
 *
 * @param row - The row to draw.
 * @param kind - What the panel holds, which decides the margin marker.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns Markup for the row.
 */
function renderRow(row: PanelRow, kind: Panel['kind'], theme: MediaTheme, atMs: number): string {
  const typeMs = row.typeMs ?? 0
  const elapsed = atMs - row.atMs
  const typing = typeMs > 0 && elapsed < typeMs
  const shown = typing ? row.text.slice(0, ceil((elapsed / typeMs) * row.text.length)) : row.text

  const body = kind === 'code' ? highlight(shown, theme.syntax) : escapeHtml(shown)
  const caret = typing ? `<span class="p-caret"></span>` : ''
  const marker = row.marker ?? ''
  const margin = marker === '' ? '' : `<span class="p-marker">${marker}</span>`
  const classes = ['p-row', `p-tone--${row.tone ?? 'plain'}`]
  if (row.emphasis === true) {
    classes.push('p-row--lit')
  }
  if (row.strike === true) {
    classes.push('p-row--struck')
  }

  return `<div class="${classes.join(' ')}">${margin}<span class="p-text">${body}${caret}</span></div>`
}

/**
 * Draw one column at one instant.
 *
 * @param panel - The column.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @param capacity - How many rows a tailed column keeps.
 * @returns Markup for the column.
 */
function renderPanel(panel: Panel, theme: MediaTheme, atMs: number, capacity: number): string {
  const live = ordered(panel).filter((row) => atMs >= row.atMs && (row.untilMs === undefined || atMs < row.untilMs))
  const rows = (panel.tail === true ? live.slice(-capacity) : live).map((row) => renderRow(row, panel.kind, theme, atMs)).join('')
  const heading = panel.title === undefined ? '' : escapeHtml(panel.title)
  const head =
    panel.chrome === true
      ? `<div class="p-bar"><span class="p-dot p-dot--1"></span><span class="p-dot p-dot--2"></span><span class="p-dot p-dot--3"></span><span class="p-bar-title">${heading}</span></div>`
      : heading === ''
        ? ''
        : `<div class="p-title">${heading}</div>`
  const classes = ['p-panel', `p-panel--${panel.kind}`, `p-panel--${panel.align ?? 'top'}`]
  if (panel.chrome === true) {
    classes.push('p-panel--chrome')
  }
  return `<div class="${classes.join(' ')}" style="flex-grow:${panel.weight ?? 1}">${head}<div class="p-rows">${rows}</div></div>`
}

/**
 * Build the stylesheet for one frame, with its theme resolved into it.
 *
 * @param config - The frame as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this frame.
 */
function panelStyles(config: PanelConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = panelMetrics(profile)
  const tones = TONES.map((tone) => `.p-tone--${tone} { color: ${theme.tones[tone]}; }`).join('\n')

  return `
.p-frame {
  position: absolute;
  inset: ${metrics.insetPx}px;
  display: flex;
  flex-direction: column;
  gap: ${metrics.gapPx}px;
}
.p-heading {
  font-size: ${metrics.headingPx}px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${theme.text.strong};
  flex: none;
}
.p-columns {
  display: flex;
  flex-direction: ${config.stacked === true ? 'column' : 'row'};
  gap: ${metrics.gapPx}px;
  flex: 1 1 auto;
  min-height: 0;
}
.p-panel {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: ${metrics.padPx}px ${metrics.padPx + 2}px;
  border: 1px solid ${theme.border};
  border-radius: ${metrics.radiusPx}px;
  background: ${theme.surface};
  box-shadow: ${theme.shadow};
  overflow: hidden;
  transition: none;
}
.p-title {
  font-size: ${metrics.titlePx}px;
  font-weight: 600;
  /* why: a column's title is as often a filename or a call as it is a word, and neither survives being uppercased */
  letter-spacing: 0.02em;
  color: ${theme.text.muted};
  padding-bottom: ${metrics.padPx - 4}px;
  margin-bottom: ${metrics.padPx - 6}px;
  border-bottom: 1px solid ${theme.rule};
}
.p-rows { font-family: ${theme.fonts.mono}; font-size: ${metrics.fontSizePx}px; line-height: ${metrics.lineHeightPx}px; }
.p-row {
  display: flex;
  /* why: a blank row is a spacer the scene asked for, and a flex box with no content is zero pixels tall */
  min-height: ${metrics.lineHeightPx}px;
  gap: ${metrics.fontSizePx * 0.5}px;
  align-items: baseline;
  white-space: pre-wrap;
  word-break: break-word;
  border-radius: 4px;
  padding: 0 3px;
  margin: 0 -3px;
}
.p-row--lit { background: ${theme.accentSoft}; }
.p-row--struck { text-decoration: line-through; opacity: 0.55; }
.p-marker { flex: none; color: ${theme.text.faint}; }
.p-text { min-width: 0; }
.p-caret {
  display: inline-block;
  width: ${max(2, ceil(metrics.fontSizePx * 0.09))}px;
  height: ${ceil(metrics.fontSizePx * 0.95)}px;
  margin-left: 1px;
  vertical-align: text-bottom;
  background: ${theme.accent};
}
.p-panel--top .p-rows { margin-bottom: auto; }
.p-panel--center .p-rows { margin: auto 0; }
.p-panel--bottom .p-rows { margin-top: auto; }
.p-panel--note .p-rows { font-family: ${theme.fonts.sans}; }
/* A column standing in for a session rather than for a listing: the bar
   replaces the title rule, so the padding moves off the panel and onto the two
   parts of it separately. */
.p-panel--chrome { padding: 0; }
.p-panel--chrome .p-rows { padding: ${metrics.padPx}px ${metrics.padPx + 2}px; }
.p-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: ${ceil(metrics.padPx * 0.36)}px;
  height: ${metrics.lineHeightPx + 8}px;
  padding: 0 ${metrics.padPx}px;
  background: ${theme.chrome.bar};
  border-bottom: 1px solid ${theme.rule};
  border-radius: ${metrics.radiusPx - 1}px ${metrics.radiusPx - 1}px 0 0;
}
.p-dot { width: ${ceil(metrics.titlePx * 0.62)}px; height: ${ceil(metrics.titlePx * 0.62)}px; border-radius: 50%; flex: none; }
.p-dot--1 { background: ${theme.chrome.buttons[0]}; }
.p-dot--2 { background: ${theme.chrome.buttons[1]}; }
.p-dot--3 { background: ${theme.chrome.buttons[2]}; }
.p-bar-title {
  margin-left: ${ceil(metrics.padPx * 0.5)}px;
  font-size: ${metrics.titlePx}px;
  letter-spacing: 0.04em;
  color: ${theme.chrome.title};
  font-family: ${theme.fonts.mono};
}
.p-caption {
  flex: none;
  min-height: ${ceil(metrics.captionPx * 1.3)}px;
  font-size: ${metrics.captionPx}px;
  color: ${theme.tones.success};
}
${tones}
`
}

/**
 * Source and what running it produced, side by side, filling in over time.
 *
 * The workhorse of the explanatory scenes. A frame is a row of panels; a panel
 * is a stack of lines; a line knows when it arrives and whether it types itself
 * in. Everything else a scene wants to say is said by how it arranges those
 * three: two panels are a before and an after, four are four wrappers fed the
 * same call, one is a listing that fills.
 *
 * Nothing is remembered between frames. Which rows have arrived, how far a
 * typing row has got, and whether its caret is lit are all read out of the
 * instant the stage was asked for, which is what lets the same scene record
 * identically on a fast machine and a slow one.
 */
export const panelStage: Stage<PanelConfig> = defineStage<PanelConfig>({
  id: 'panel',

  styles: panelStyles,

  durationMs(config: PanelConfig): number {
    return settledAt(config) + (config.restMs ?? 1200)
  },

  frame({ config, profile, theme, atMs }): string {
    const capacity = rowCapacity(config, profile)
    const columns = config.panels.map((panel) => renderPanel(panel, theme, atMs, capacity)).join('')
    const heading = config.heading === undefined ? '' : `<div class="p-heading">${escapeHtml(config.heading)}</div>`
    const settled = settledAt(config)
    // why: the caption's room is held from the first frame, so its arrival adds a line rather than moving everything above it up by one
    const caption =
      config.caption === undefined
        ? ''
        : `<div class="p-caption">${atMs >= settled + CAPTION_DELAY_MS ? escapeHtml(config.caption) : ''}</div>`

    return `<div class="p-frame">${heading}<div class="p-columns">${columns}</div>${caption}</div>`
  },
})
