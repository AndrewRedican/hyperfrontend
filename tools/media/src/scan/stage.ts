import type { MediaProfile } from '../models/profile'
import type { ScanConfig, ScanFinding, ScanTone } from '../models/scan'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { ceil, max, min, PI, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'

/** Width past which the frame is drawn at its full density. */
const WIDE_ENOUGH = 800

/** How long a finding takes to grow to its full size after it appears. */
const POP_MS = 260

/** How long the thread from a file to its finding stays drawn. */
const THREAD_MS = 900

/** How long the closing caption takes to arrive after the last finding. */
const CAPTION_DELAY_MS = 300

/** How the frame is sized for the surface it is being drawn for. */
interface ScanMetrics {
  /** Margin between the frame's content and its edge. */
  insetPx: number
  /** Gap between the tree and the findings. */
  gapPx: number
  /** Padding inside a panel. */
  padPx: number
  /** Height of one file row. */
  rowPx: number
  /** Font size of a file path. */
  filePx: number
  /** Font size of a finding's label. */
  labelPx: number
  /** Font size of a finding's evidence line. */
  evidencePx: number
  /** Height of one finding card, gap included. */
  cardPx: number
  /** Diameter of the confidence ring. */
  ringPx: number
  /** Font size of the heading. */
  headingPx: number
  /** Font size of the caption. */
  captionPx: number
  /** Width of the tree panel, as a fraction of the row. */
  treeShare: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
function scanMetrics(profile: MediaProfile): ScanMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  return {
    insetPx: wide ? 28 : 18,
    gapPx: wide ? 22 : 16,
    padPx: wide ? 14 : 11,
    rowPx: wide ? 24 : 21,
    filePx: wide ? 13 : 11.5,
    labelPx: wide ? 14 : 12.5,
    evidencePx: wide ? 11.5 : 10.5,
    cardPx: wide ? 58 : 52,
    ringPx: wide ? 36 : 32,
    headingPx: wide ? 15 : 14,
    captionPx: wide ? 14 : 12.5,
    treeShare: 0.42,
  }
}

/**
 * Where the sweep is at one instant, as a row position.
 *
 * Between two files the beam travels smoothly from one row to the next, so it
 * reads as a thing moving down the tree rather than a highlight jumping.
 *
 * @param config - The scan as the scene configured it.
 * @param atMs - Offset from the start of the timeline.
 * @returns A fractional row index, or -1 before the sweep starts.
 */
function beamRow(config: ScanConfig, atMs: number): number {
  const files = config.files
  const first = files[0]
  if (first === undefined || atMs < first.atMs) {
    return -1
  }
  for (let index = 0; index < files.length - 1; index += 1) {
    const here = files[index]
    const next = files[index + 1]
    if (here !== undefined && next !== undefined && atMs < next.atMs) {
      const span = max(1, next.atMs - here.atMs)
      return index + min(1, (atMs - here.atMs) / span)
    }
  }
  return files.length - 1
}

/**
 * The colour a finding's tone maps to.
 *
 * @param tone - The meaning the finding carries, or undefined for the accent.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns A CSS colour.
 */
function toneColour(tone: ScanTone | undefined, theme: MediaTheme): string {
  return tone === 'success'
    ? theme.tones.success
    : tone === 'warning'
      ? theme.tones.warning
      : tone === 'muted'
        ? theme.text.faint
        : theme.accent
}

/**
 * When the last finding has landed.
 *
 * @param config - The scan as the scene configured it.
 * @returns The offset at which nothing is still arriving.
 */
function settledAt(config: ScanConfig): number {
  let latest = 0
  for (const finding of config.findings) {
    latest = max(latest, finding.atMs + POP_MS)
  }
  for (const file of config.files) {
    latest = max(latest, file.atMs)
  }
  return latest
}

/**
 * Draw one finding at one instant.
 *
 * @param finding - The fact.
 * @param index - Its position among the findings shown so far.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns Markup for the card.
 */
function renderFinding(finding: ScanFinding, index: number, metrics: ScanMetrics, theme: MediaTheme, atMs: number): string {
  const progress = min(1, max(0, (atMs - finding.atMs) / POP_MS))
  const eased = 1 - (1 - progress) ** 3
  const colour = toneColour(finding.tone, theme)
  const radius = metrics.ringPx / 2 - 3
  const circumference = 2 * PI * radius
  const offset = circumference * (1 - (finding.confidence / 100) * eased)
  const ring = `<svg class="sc-ring" viewBox="0 0 ${metrics.ringPx} ${metrics.ringPx}" aria-hidden="true">
    <circle cx="${metrics.ringPx / 2}" cy="${metrics.ringPx / 2}" r="${radius}" fill="none" stroke="${theme.rule}" stroke-width="3"/>
    <circle cx="${metrics.ringPx / 2}" cy="${metrics.ringPx / 2}" r="${radius}" fill="none" stroke="${colour}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 ${metrics.ringPx / 2} ${metrics.ringPx / 2})"/>
    <text x="50%" y="50%" dy="0.36em" text-anchor="middle" class="sc-ring-text" fill="${colour}">${round(finding.confidence * eased)}</text>
  </svg>`
  const style = `top:${index * metrics.cardPx}px; transform: scale(${(0.9 + 0.1 * eased).toFixed(3)}); opacity:${eased.toFixed(3)};`
  return `<div class="sc-card" style="${style}">${ring}<div class="sc-card-text"><div class="sc-label" style="color:${colour}">${escapeHtml(finding.label)}</div><div class="sc-evidence">${escapeHtml(finding.evidence)}</div></div></div>`
}

/**
 * Build the stylesheet for one scan, with its theme resolved into it.
 *
 * @param config - The scan as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this scan.
 */
function scanStyles(config: ScanConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = scanMetrics(profile)
  return `
.sc-frame { position: absolute; inset: ${metrics.insetPx}px; display: flex; flex-direction: column; gap: ${metrics.gapPx * 0.7}px; }
.sc-heading { flex: none; font-size: ${metrics.headingPx}px; font-weight: 600; letter-spacing: -0.01em; color: ${theme.text.strong}; }
.sc-body { flex: 1 1 auto; min-height: 0; position: relative; display: flex; gap: ${metrics.gapPx}px; }
.sc-tree {
  flex: 0 0 ${(metrics.treeShare * 100).toFixed(1)}%;
  position: relative;
  padding: ${metrics.padPx}px ${metrics.padPx + 2}px;
  border: 1px solid ${theme.border};
  border-radius: 10px;
  background: ${theme.surface};
  box-shadow: ${theme.shadow};
  font-family: ${theme.fonts.mono};
  font-size: ${metrics.filePx}px;
  overflow: hidden;
}
.sc-root { color: ${theme.text.muted}; height: ${metrics.rowPx}px; line-height: ${metrics.rowPx}px; padding-bottom: 4px; border-bottom: 1px solid ${theme.rule}; margin-bottom: 4px; white-space: nowrap; }
.sc-file { position: relative; height: ${metrics.rowPx}px; line-height: ${metrics.rowPx}px; color: ${theme.text.faint}; white-space: pre; z-index: 1; }
.sc-file--read { color: ${theme.text.plain}; }
.sc-file--source { color: ${theme.text.strong}; font-weight: 600; }
.sc-beam {
  position: absolute;
  left: 0;
  right: 0;
  height: ${metrics.rowPx}px;
  background: linear-gradient(90deg, ${theme.accentSoft} 0%, transparent 100%);
  border-left: 2px solid ${theme.accent};
}
.sc-findings { flex: 1 1 auto; min-width: 0; position: relative; }
.sc-card {
  position: absolute;
  left: 0;
  right: 0;
  height: ${metrics.cardPx - 8}px;
  display: flex;
  align-items: center;
  gap: ${metrics.padPx}px;
  padding: 0 ${metrics.padPx}px;
  border: 1px solid ${theme.border};
  border-radius: 10px;
  background: ${theme.surface};
  box-shadow: ${theme.shadow};
  transform-origin: left center;
}
.sc-ring { flex: none; width: ${metrics.ringPx}px; height: ${metrics.ringPx}px; }
.sc-ring-text { font-family: ${theme.fonts.mono}; font-size: ${round(metrics.ringPx * 0.3)}px; font-weight: 600; }
.sc-card-text { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.sc-label { font-size: ${metrics.labelPx}px; font-weight: 600; white-space: nowrap; }
.sc-evidence { font-size: ${metrics.evidencePx}px; color: ${theme.text.muted}; font-family: ${theme.fonts.mono}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-thread { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.sc-caption { flex: none; min-height: ${ceil(metrics.captionPx * 1.3)}px; font-size: ${metrics.captionPx}px; color: ${theme.tones.success}; }
`
}

/**
 * A repository nobody described, read file by file.
 *
 * A beam sweeps down a file tree; each file it passes lights up, and the
 * facts the scan establishes from it appear beside the tree with a thread
 * back to the file they were read from and a ring filling to the confidence
 * the scan puts on them. The thread is the point: a detection is a claim
 * with evidence, and the frame shows the evidence being found rather than the
 * claim being announced.
 */
export const scanStage: Stage<ScanConfig> = defineStage<ScanConfig>({
  id: 'scan',

  styles: scanStyles,

  durationMs(config: ScanConfig): number {
    return settledAt(config) + (config.restMs ?? 1200)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = scanMetrics(profile)
    const row = beamRow(config, atMs)
    const shown = [...config.findings].filter((finding) => atMs >= finding.atMs).sort((left, right) => left.atMs - right.atMs)
    const sources = shown.filter((finding) => atMs - finding.atMs < THREAD_MS).map((finding) => finding.file)

    const files = config.files
      .map((file, index) => {
        const classes = ['sc-file']
        if (row >= index) {
          classes.push('sc-file--read')
        }
        if (sources.includes(index)) {
          classes.push('sc-file--source')
        }
        return `<div class="${classes.join(' ')}">${escapeHtml(file.path)}</div>`
      })
      .join('')
    const beamTop = metrics.padPx + metrics.rowPx + 8 + row * metrics.rowPx
    const beam = row < 0 ? '' : `<div class="sc-beam" style="top:${beamTop.toFixed(1)}px"></div>`

    // why: a thread is drawn from the file's row to its card while the card is new, so the reader sees where the claim came from at the moment it is made
    const bodyWidth = profile.width - metrics.insetPx * 2
    const treeWidth = bodyWidth * metrics.treeShare
    const threads = shown
      .map((finding, index) => {
        const age = atMs - finding.atMs
        if (age >= THREAD_MS) {
          return ''
        }
        const fade = 1 - age / THREAD_MS
        const y1 = beamTop - row * metrics.rowPx + finding.file * metrics.rowPx + metrics.rowPx / 2
        const y2 = index * metrics.cardPx + (metrics.cardPx - 8) / 2
        const x1 = treeWidth - metrics.padPx
        const x2 = treeWidth + metrics.gapPx
        return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + 40).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - 30).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${theme.accent}" stroke-width="1.5" stroke-dasharray="4 3" opacity="${fade.toFixed(2)}"/>`
      })
      .join('')
    const cards = shown.map((finding, index) => renderFinding(finding, index, metrics, theme, atMs)).join('')

    const heading = config.heading === undefined ? '' : `<div class="sc-heading">${escapeHtml(config.heading)}</div>`
    const caption =
      config.caption === undefined
        ? ''
        : `<div class="sc-caption">${atMs >= settledAt(config) + CAPTION_DELAY_MS ? escapeHtml(config.caption) : ''}</div>`

    return `<div class="sc-frame">${heading}<div class="sc-body">
      <div class="sc-tree"><div class="sc-root">${escapeHtml(config.root)}</div>${beam}${files}</div>
      <div class="sc-findings">${cards}</div>
      <svg class="sc-thread" aria-hidden="true">${threads}</svg>
    </div>${caption}</div>`
  },
})
