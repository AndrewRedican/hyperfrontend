import type { ByteConfig, ByteSegment, ByteTone } from '../models/byte'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import { ceil, floor, max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { STAGE_ELEMENT_ID } from '../stage/document'
import { resolveByteTheme } from './themes'

/** Every tone a theme colours, in the order the stylesheet declares them. */
const TONES: readonly ByteTone[] = ['plain', 'muted', 'accent', 'success', 'warning', 'danger']

/** Width past which the frame is drawn at its full density. */
const WIDE_ENOUGH = 800

/** How long the closing caption takes to arrive after the last cell. */
const CAPTION_DELAY_MS = 300

/** The face labels are set in. */
const FONT_STACK = "'Liberation Sans', 'DejaVu Sans', 'Inter', Helvetica, Arial, sans-serif"

/** The face the source line and the byte counts are set in. */
const MONO_STACK = "'Liberation Mono', 'DejaVu Sans Mono', 'JetBrains Mono', Menlo, monospace"

/** Advance width of one label character, as a fraction of the font size. */
const LABEL_RATIO = 0.55

/** How the frame is sized for the surface it is being drawn for. */
interface ByteMetrics {
  /** Margin between the field and the edge of the frame. */
  insetPx: number
  /** Gap between two cells. */
  cellGapPx: number
  /** Gap between two segments. */
  segmentGapPx: number
  /** Height of a cell. */
  cellPx: number
  /** Font size of a segment's label. */
  labelPx: number
  /** Font size of the heading, the source line and the caption. */
  chromePx: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
function byteMetrics(profile: MediaProfile): ByteMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  return {
    insetPx: wide ? 30 : 18,
    cellGapPx: wide ? 2 : 1,
    segmentGapPx: wide ? 14 : 9,
    cellPx: wide ? 26 : 20,
    labelPx: wide ? 12 : 10,
    chromePx: wide ? 15 : 12,
  }
}

/**
 * How many of a segment's cells have been written at one instant.
 *
 * @param segment - The run of bytes.
 * @param atMs - Offset from the start of the timeline.
 * @returns A count between zero and the segment's own length.
 */
function writtenCells(segment: ByteSegment, atMs: number): number {
  if (atMs < segment.atMs) {
    return 0
  }
  const fillMs = segment.fillMs ?? 0
  if (fillMs <= 0) {
    return segment.count
  }
  const progress = min(1, (atMs - segment.atMs) / fillMs)
  return min(segment.count, ceil(progress * segment.count))
}

/**
 * When the last cell of the field is written.
 *
 * @param config - The frame as the scene configured it.
 * @returns The offset at which the buffer is complete.
 */
function settledAt(config: ByteConfig): number {
  let latest = 0
  for (const segment of config.segments) {
    latest = max(latest, segment.atMs + (segment.fillMs ?? 0))
  }
  for (const annotation of config.annotations ?? []) {
    latest = max(latest, annotation.atMs)
  }
  return latest
}

/**
 * Draw one run of bytes at one instant.
 *
 * @param segment - The run.
 * @param atMs - Offset from the start of the timeline.
 * @param cellPx - How wide a cell is drawn, before its gap.
 * @param widthPx - How wide the whole column is, cells or caption, whichever is wider.
 * @returns Markup for the segment.
 */
function renderSegment(segment: ByteSegment, atMs: number, cellPx: number, widthPx: number): string {
  const written = writtenCells(segment, atMs)
  const tone = `b-tone--${segment.tone ?? 'accent'}`
  const cells: string[] = []
  for (let index = 0; index < segment.count; index += 1) {
    const filled = index < written ? ` b-cell--filled ${tone}` : ''
    cells.push(`<span class="b-cell${filled}" style="width:${cellPx}px"></span>`)
  }
  const note = segment.note === undefined ? '' : `<div class="b-note">${escapeHtml(segment.note)}</div>`
  // why: the count is the fact a reader takes away, so it is set with the name rather than left to be counted off the cells
  return `<div class="b-segment" style="width:${widthPx}px">
    <div class="b-cells">${cells.join('')}</div>
    <div class="b-bracket"></div>
    <div class="b-label">${escapeHtml(segment.label)} <span class="b-count">${segment.count}B</span></div>
    ${note}
  </div>`
}

/**
 * How wide a segment's writing is, before its cells are considered.
 *
 * A one-byte field is one cell wide and six characters long, so the caption is
 * what decides its footprint rather than its bytes. Estimating that here is
 * what stops a `version 1B` label from stretching its own column and pushing
 * the tag off the right-hand edge of the frame.
 *
 * @param segment - The run of bytes.
 * @param labelPx - Font size of a segment's label.
 * @returns An estimate in pixels.
 */
function captionWidth(segment: ByteSegment, labelPx: number): number {
  const named = `${segment.label} ${segment.count}B`.length
  const noted = (segment.note ?? '').length
  return max(named, noted) * labelPx * LABEL_RATIO
}

/**
 * The widest cell that lets the whole field fit the frame.
 *
 * Solved by search rather than by division, because a segment is as wide as
 * the wider of its cells and its caption, and that maximum is not linear in
 * the cell width. Twenty-six pixels down to three is a short enough ladder to
 * walk, and walking it is cheaper than being wrong about the layout.
 *
 * @param config - The frame as the scene configured it.
 * @param metrics - The measurements this profile is drawn at.
 * @param roomPx - The width available to the field, gaps excluded.
 * @returns A cell width in pixels.
 */
function fitCellWidth(config: ByteConfig, metrics: ByteMetrics, roomPx: number): number {
  for (let cellPx = metrics.cellPx; cellPx > 3; cellPx -= 1) {
    const used = config.segments.reduce(
      (sum, segment) => sum + max(segment.count * (cellPx + metrics.cellGapPx) - metrics.cellGapPx, captionWidth(segment, metrics.labelPx)),
      0
    )
    if (used <= roomPx) {
      return cellPx
    }
  }
  return 3
}

/**
 * Build the stylesheet for one frame, with its theme resolved into it.
 *
 * @param config - The frame as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @returns CSS for this frame.
 */
function byteStyles(config: ByteConfig, profile: MediaProfile): string {
  const theme = resolveByteTheme(config.theme)
  const metrics = byteMetrics(profile)
  const tones = TONES.map((tone) => `.b-tone--${tone} { background: ${theme.tones[tone]}; }`).join('\n')

  return `
#${STAGE_ELEMENT_ID} { background: ${theme.backdrop}; font-family: ${FONT_STACK}; }
.b-frame {
  position: absolute;
  inset: ${metrics.insetPx}px;
  display: flex;
  flex-direction: column;
  gap: ${metrics.segmentGapPx}px;
}
.b-heading {
  flex: none;
  font-size: ${metrics.chromePx}px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${theme.label};
}
.b-source {
  flex: none;
  font-family: ${MONO_STACK};
  font-size: ${metrics.chromePx - 1}px;
  color: ${theme.source};
}
/* why: the field and the lines that explain it are one object, so they are
   centred together in the room under the source line rather than each finding
   its own middle and leaving a hole between them */
.b-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${metrics.segmentGapPx * 2}px;
}
.b-field { flex: none; display: flex; align-items: flex-start; gap: ${metrics.segmentGapPx}px; }
.b-segment { flex: none; min-width: 0; display: flex; flex-direction: column; }
.b-cells { display: flex; gap: ${metrics.cellGapPx}px; }
.b-cell { height: ${metrics.cellPx}px; border-radius: 2px; background: ${theme.empty}; }
.b-cell--filled { border-radius: 2px; }
.b-bracket {
  height: ${floor(metrics.cellPx / 4)}px;
  margin-top: 5px;
  border: 1px solid ${theme.bracket};
  border-top: none;
  border-radius: 0 0 4px 4px;
}
.b-label { margin-top: 5px; font-size: ${metrics.labelPx}px; color: ${theme.label}; }
.b-count { font-family: ${MONO_STACK}; color: ${theme.note}; }
.b-note { margin-top: 2px; font-size: ${metrics.labelPx - 2}px; color: ${theme.note}; }
.b-notes {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: ${floor(metrics.segmentGapPx / 3)}px;
  font-family: ${MONO_STACK};
  font-size: ${metrics.labelPx + 1}px;
}
.b-annotation { color: ${theme.label}; }
.b-annotation.b-text--muted { color: ${theme.tones.muted}; }
.b-annotation.b-text--accent { color: ${theme.tones.accent}; }
.b-annotation.b-text--success { color: ${theme.tones.success}; }
.b-annotation.b-text--warning { color: ${theme.tones.warning}; }
.b-annotation.b-text--danger { color: ${theme.tones.danger}; }
.b-caption { flex: none; font-family: ${FONT_STACK}; font-size: ${metrics.chromePx}px; color: ${theme.tones.success}; }
${tones}
`
}

/**
 * A buffer assembling itself, in labelled runs.
 *
 * For the packages whose subject is a layout rather than a call. What a
 * password-based encrypt actually hands back is not an opaque blob: it is a
 * salt, an initialisation vector, a ciphertext and an authentication tag, in
 * that order, and knowing that is most of knowing how to use it. A sealed
 * protocol frame is the same kind of fact.
 *
 * The cells fill left to right because the order is the point, and every
 * segment carries its own byte count, because the count is what a reader takes
 * away rather than something to be counted off the screen.
 */
export const byteStage: Stage<ByteConfig> = defineStage<ByteConfig>({
  id: 'byte',

  styles: byteStyles,

  durationMs(config: ByteConfig): number {
    return settledAt(config) + (config.restMs ?? 1200)
  },

  frame({ config, profile, atMs }): string {
    const metrics = byteMetrics(profile)
    const gaps = metrics.segmentGapPx * max(0, config.segments.length - 1)
    const room = profile.width - metrics.insetPx * 2 - gaps
    // why: the field has to fit whatever the scene names, and what it has to fit is the wider of each segment's cells and its caption rather than the byte count alone
    const cellPx = fitCellWidth(config, metrics, room)

    const field = config.segments
      .map((segment) =>
        renderSegment(
          segment,
          atMs,
          cellPx,
          max(segment.count * (cellPx + metrics.cellGapPx) - metrics.cellGapPx, captionWidth(segment, metrics.labelPx))
        )
      )
      .join('')
    const heading = config.heading === undefined ? '' : `<div class="b-heading">${escapeHtml(config.heading)}</div>`
    const source = config.source === undefined ? '' : `<div class="b-source">${escapeHtml(config.source)}</div>`
    const notes = (config.annotations ?? [])
      .filter((annotation) => atMs >= annotation.atMs && (annotation.untilMs === undefined || atMs < annotation.untilMs))
      .map((annotation) => `<div class="b-annotation b-text--${annotation.tone ?? 'plain'}">${escapeHtml(annotation.text)}</div>`)
      .join('')
    const caption =
      config.caption !== undefined && atMs >= settledAt(config) + CAPTION_DELAY_MS
        ? `<div class="b-caption">${escapeHtml(config.caption)}</div>`
        : ''

    return `<div class="b-frame">${heading}${source}<div class="b-body"><div class="b-field">${field}</div><div class="b-notes">${notes}</div></div>${caption}</div>`
  },
})
