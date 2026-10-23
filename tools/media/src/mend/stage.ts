import type { MendConfig, MendFinding } from '../models/mend'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { Rect } from '../stage/geometry'
import { max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { renderCheck } from '../bridge/render'
import { escapeHtml } from '../lib/escape-html'
import { easeInOut, easeOut, lerp, progress } from '../lib/motion'
import { highlight } from '../panel/syntax'
import { apiChipStyles, renderApiChip } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'

/** Width of the composition every measurement is stated for; other widths scale from it. */
const BASE_WIDTH = 640

/** Advance of the mono face as a fraction of its size. */
const MONO_ADVANCE = 0.6

/** When the beam starts reading. */
const READ_AT_MS = 400

/** How long a node takes to pop in once the beam reaches its line. */
const POP_MS = 280

/** How long a finding's underline and tag take to appear. */
const MARK_MS = 320

/** How long the beam takes to fade once it has read the last line. */
const BEAM_FADE_MS = 250

/** How long after the beam fades the fix flag lights. */
const FIX_AFTER_MS = 600

/** How long the fix flag takes to light. */
const FLAG_MS = 300

/** How long after the flag lights the first fix lands. */
const FIRST_FIX_MS = 500

/** How far apart the fixes land. */
const FIX_GAP_MS = 650

/** How long a fixed span takes to settle from the success tone into its own colour. */
const SETTLE_MS = 520

/** How long an underline takes to retract once its span is fixed. */
const RETRACT_MS = 250

/** How long after the last fix the check lands beside the file's name. */
const CHECK_AFTER_MS = 450

/** How long the check takes to draw. */
const CHECK_MS = 420

/** How the frame is sized for the surface it is being drawn for. */
interface MendMetrics {
  /** Factor every measurement is scaled by from the compact composition. */
  k: number
  /** The sheet's box. */
  sheet: Rect
  /** Left edge of the listing's text. */
  textX: number
  /** Centre line of the file's name. */
  fileY: number
  /** The rule under the file's name. */
  ruleY: number
  /** Centre line of the first code line. */
  firstLineY: number
  /** Distance between code lines. */
  lineH: number
  /** Font size of the code. */
  codePx: number
  /** Font size of the file's name. */
  filePx: number
  /** Font size of a node's label. */
  nodePx: number
  /** Height of a node. */
  nodeH: number
  /** Font size of a finding's tag. */
  tagPx: number
  /** Left edge of the tree. */
  treeX: number
  /** How far a nested node sits right of its parent. */
  indentPx: number
  /** Font size of the command chip. */
  chipPx: number
}

/** One node of the tree, mirrored from a line of the listing. */
interface MendNode {
  /** The line it mirrors. */
  line: number
  /** How deep it nests. */
  depth: number
  /** Index of the node it nests under, or -1 at the top. */
  parent: number
}

/** When everything happens. */
interface MendTimeline {
  /** When the beam has read the last line. */
  beamEndAt: number
  /** When the fix flag lights. */
  fixAt: number
  /** When each finding's fix lands, index for index with the findings. */
  fixedAt: readonly number[]
  /** When the check lands beside the file's name. */
  checkAt: number
  /** When the last motion has finished. */
  settledAt: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param config - The listing, which decides the sheet's height.
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
function mendMetrics(config: MendConfig, profile: MediaProfile): MendMetrics {
  const k = profile.width / BASE_WIDTH
  const lineH = round(24 * k)
  const headerH = round(46 * k)
  const h = headerH + round(8 * k) + config.lines.length * lineH + round(14 * k)
  const sheet = { x: round(18 * k), y: round((profile.height - h) / 2), w: round(352 * k), h }
  return {
    k,
    sheet,
    textX: sheet.x + round(16 * k),
    fileY: sheet.y + round(20 * k),
    ruleY: sheet.y + headerH - round(8 * k),
    firstLineY: sheet.y + headerH + round(8 * k) + round(lineH / 2),
    lineH,
    codePx: round(13 * k),
    filePx: round(12 * k),
    nodePx: round(12 * k),
    nodeH: round(21 * k),
    tagPx: round(11 * k),
    treeX: sheet.x + sheet.w + round(26 * k),
    indentPx: round(22 * k),
    chipPx: round(12 * k),
  }
}

/**
 * The tree the listing mirrors: one node per statement line, nested by indent.
 *
 * @param lines - The listing.
 * @returns The nodes in reading order.
 */
function treeOf(lines: readonly string[]): MendNode[] {
  const nodes: MendNode[] = []
  lines.forEach((text, line) => {
    const trimmed = text.trim()
    if (trimmed === '' || trimmed === '}') {
      return
    }
    const depth = (text.length - text.trimStart().length) / 2
    let parent = -1
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      if ((nodes[index] as MendNode).depth < depth) {
        parent = index
        break
      }
    }
    nodes.push({ line, depth, parent })
  })
  return nodes
}

/**
 * Work out when everything happens.
 *
 * @param config - The scene's configuration.
 * @returns Every moment of the timeline.
 */
function timelineOf(config: MendConfig): MendTimeline {
  const beamEndAt = READ_AT_MS + config.lines.length * config.readLineMs
  const fixAt = beamEndAt + BEAM_FADE_MS + FIX_AFTER_MS
  const fixedAt = config.findings.map((_finding, index) => fixAt + FLAG_MS + FIRST_FIX_MS + index * FIX_GAP_MS)
  const lastFix = fixedAt.length === 0 ? fixAt + FLAG_MS : (fixedAt[fixedAt.length - 1] as number) + SETTLE_MS
  const checkAt = lastFix + CHECK_AFTER_MS
  return { beamEndAt, fixAt, fixedAt, checkAt, settledAt: checkAt + CHECK_MS }
}

/**
 * When the beam reaches a line.
 *
 * @param config - The scene's configuration.
 * @param line - The line's index.
 * @returns The moment the beam is centred on it.
 */
function readAt(config: MendConfig, line: number): number {
  return READ_AT_MS + line * config.readLineMs + config.readLineMs * 0.5
}

/**
 * The text of a line at one instant, with every fix that has landed written in.
 *
 * @param config - The scene's configuration.
 * @param timeline - When each fix lands.
 * @param line - The line's index.
 * @param atMs - Offset from the start of the timeline.
 * @returns What the line reads at that instant, fixes included.
 */
function lineTextAt(config: MendConfig, timeline: MendTimeline, line: number, atMs: number): string {
  const text = config.lines[line] as string
  const finding = config.findings.findIndex((candidate) => candidate.line === line)
  if (finding < 0 || atMs < (timeline.fixedAt[finding] as number)) {
    return text
  }
  const fix = config.findings[finding] as MendFinding
  return text.slice(0, fix.from) + fix.text + text.slice(fix.to)
}

/**
 * The first word of a line, which labels its node.
 *
 * @param text - The line's text.
 * @returns The leading word.
 */
function labelOf(text: string): string {
  return /^[A-Za-z_$][\w$]*/.exec(text.trim())?.[0] ?? text.trim().slice(0, 1)
}

/**
 * Tint every colour in a highlighted fragment towards a tone.
 *
 * @param html - A fragment the highlighter produced.
 * @param tone - The colour to mix in.
 * @param amount - How much of the tone, from 0 to 1.
 * @param plain - The colour of text the highlighter left uncoloured.
 * @returns The fragment, every colour mixed.
 */
function tinted(html: string, tone: string, amount: number, plain: string): string {
  const pct = `${round(amount * 100)}%`
  const mixed = html.replace(/color:([^"]+)"/g, (_match, colour: string) => `color:color-mix(in srgb, ${tone} ${pct}, ${colour})"`)
  return `<span style="color:color-mix(in srgb, ${tone} ${pct}, ${plain})">${mixed}</span>`
}

/**
 * Draw the listing, each line's text as it stands at this instant.
 *
 * Nothing here carries an `opacity` or a `transform`: either one makes the
 * browser composite the element through a surface of its own, and a headless
 * screenshot can catch that surface with another element's pixels still in
 * it. A fixed span settles by mixing its colours.
 *
 * @param config - The scene's configuration.
 * @param timeline - When each fix lands.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns HTML markup, one positioned row per line.
 */
function renderLines(config: MendConfig, timeline: MendTimeline, metrics: MendMetrics, theme: MediaTheme, atMs: number): string {
  return config.lines
    .map((_text, line) => {
      const text = lineTextAt(config, timeline, line, atMs)
      const finding = config.findings.findIndex((candidate) => candidate.line === line)
      const fixedAt = finding < 0 ? Number.POSITIVE_INFINITY : (timeline.fixedAt[finding] as number)
      let code: string
      if (finding >= 0 && atMs >= fixedAt && atMs < fixedAt + SETTLE_MS) {
        const fix = config.findings[finding] as MendFinding
        const amount = 1 - easeInOut(progress(atMs, fixedAt, SETTLE_MS))
        code =
          highlight(text.slice(0, fix.from), theme.syntax) +
          tinted(highlight(text.slice(fix.from, fix.from + fix.text.length), theme.syntax), theme.tones.success, amount, theme.text.plain) +
          highlight(text.slice(fix.from + fix.text.length), theme.syntax)
      } else {
        code = highlight(text, theme.syntax)
      }
      const top = metrics.firstLineY + line * metrics.lineH - round(metrics.lineH / 2)
      return `<div class="md-line" style="left:${metrics.textX}px;top:${top}px"><span class="md-code">${code}</span></div>`
    })
    .join('')
}

/**
 * Draw the sheet: its surface, the file's name, the rule under it, and the check once every fix is in.
 *
 * @param config - The scene's configuration.
 * @param timeline - When the check lands.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup.
 */
function renderSheet(config: MendConfig, timeline: MendTimeline, metrics: MendMetrics, theme: MediaTheme, atMs: number): string {
  const { sheet } = metrics
  const box = `<rect x="${sheet.x}" y="${sheet.y}" width="${sheet.w}" height="${sheet.h}" rx="${round(10 * metrics.k)}" fill="${theme.surface}" stroke="${theme.border}" stroke-width="1.5"/>`
  const name = `<text class="md-mono" x="${metrics.textX}" y="${metrics.fileY}" font-size="${metrics.filePx}" fill="${theme.text.faint}" dominant-baseline="central">${escapeHtml(config.file)}</text>`
  const rule = `<line x1="${sheet.x}" y1="${metrics.ruleY}" x2="${sheet.x + sheet.w}" y2="${metrics.ruleY}" stroke="${theme.rule}" stroke-width="1"/>`
  const drawn = easeOut(progress(atMs, timeline.checkAt, CHECK_MS))
  const checkX = metrics.textX + config.file.length * metrics.filePx * MONO_ADVANCE + round(14 * metrics.k)
  const check =
    drawn > 0 ? renderCheck({ x: checkX, y: metrics.fileY }, round(11 * metrics.k), theme.tones.success, 2.2 * metrics.k, drawn) : ''
  return `${box}${name}${rule}${check}`
}

/**
 * Draw the beam that reads the listing, a band over the line it is on.
 *
 * @param config - The scene's configuration.
 * @param timeline - When the beam is done.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup, empty before the beam starts and after it fades.
 */
function renderBeam(config: MendConfig, timeline: MendTimeline, metrics: MendMetrics, theme: MediaTheme, atMs: number): string {
  if (atMs < READ_AT_MS || atMs >= timeline.beamEndAt + BEAM_FADE_MS) {
    return ''
  }
  const slot = min(config.lines.length - 1, (atMs - READ_AT_MS) / config.readLineMs)
  const line = min(config.lines.length - 1, round(slot - 0.5 + 1e-9))
  const from = max(0, line - 1)
  // why: the band glides between lines over the first part of each slot and rests on the line for the remainder, so a reader sees it pause on every line
  const glide = easeInOut(progress(slot - line, 0, 0.55))
  const y = metrics.firstLineY + lerp(from, line, line === 0 ? 1 : glide) * metrics.lineH
  const fade = atMs < timeline.beamEndAt ? easeOut(progress(atMs, READ_AT_MS, 200)) : 1 - progress(atMs, timeline.beamEndAt, BEAM_FADE_MS)
  const top = (y - metrics.lineH / 2).toFixed(1)
  const band = `<rect x="${metrics.sheet.x + 1}" y="${top}" width="${metrics.sheet.w - 2}" height="${metrics.lineH}" fill="${theme.accent}" opacity="${(0.11 * fade).toFixed(3)}"/>`
  const edge = `<rect x="${metrics.sheet.x}" y="${top}" width="${round(3 * metrics.k)}" height="${metrics.lineH}" fill="${theme.accent}" opacity="${(0.9 * fade).toFixed(3)}"/>`
  return `${band}${edge}`
}

/**
 * A wavy underline between two columns of a line.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param line - The line's index.
 * @param from - The column the underline starts at.
 * @param to - The column it ends before.
 * @returns The path's `d` attribute.
 */
function wavePath(metrics: MendMetrics, line: number, from: number, to: number): string {
  const advance = metrics.codePx * MONO_ADVANCE
  const x0 = metrics.textX + from * advance
  const x1 = metrics.textX + to * advance
  const y = metrics.firstLineY + line * metrics.lineH + metrics.codePx * 0.66
  const amplitude = 1.6 * metrics.k
  const period = 4 * metrics.k
  let d = `M ${x0.toFixed(1)} ${y.toFixed(1)}`
  let up = true
  for (let x = x0 + period / 2; x <= x1 + 0.01; x += period / 2) {
    d += ` L ${x.toFixed(1)} ${(y + (up ? -amplitude : amplitude)).toFixed(1)}`
    up = !up
  }
  return d
}

/**
 * Draw every finding's underline on the sheet: drawn as the beam passes, retracted as the fix lands.
 *
 * @param config - The scene's configuration.
 * @param timeline - When each fix lands.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup.
 */
function renderUnderlines(config: MendConfig, timeline: MendTimeline, metrics: MendMetrics, theme: MediaTheme, atMs: number): string {
  return config.findings
    .map((finding, index) => {
      const markAt = readAt(config, finding.line)
      const fixedAt = timeline.fixedAt[index] as number
      if (atMs < markAt || atMs >= fixedAt + RETRACT_MS) {
        return ''
      }
      const drawn = atMs < fixedAt ? easeOut(progress(atMs, markAt, MARK_MS)) : 1 - easeInOut(progress(atMs, fixedAt, RETRACT_MS))
      return `<path d="${wavePath(metrics, finding.line, finding.from, finding.to)}" fill="none" stroke="${theme.tones.warning}" stroke-width="${(1.5 * metrics.k).toFixed(2)}" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${(1 - drawn).toFixed(3)}"/>`
    })
    .join('')
}

/**
 * Draw the tree: a node per statement line at the height of its line, nested by indent, with each finding's tag beside the node its rule listens on.
 *
 * @param config - The scene's configuration.
 * @param timeline - When each fix lands.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the edges, the nodes and the tags.
 */
function renderTree(config: MendConfig, timeline: MendTimeline, metrics: MendMetrics, theme: MediaTheme, atMs: number): string {
  const nodes = treeOf(config.lines)
  const advance = metrics.nodePx * MONO_ADVANCE
  const padX = round(8 * metrics.k)
  const boxes = nodes.map((node) => {
    const label = labelOf(lineTextAt(config, timeline, node.line, atMs))
    const x = metrics.treeX + node.depth * metrics.indentPx
    const y = metrics.firstLineY + node.line * metrics.lineH
    return { node, label, x, y, w: round(label.length * advance + padX * 2) }
  })
  const edges = boxes
    .map((box) => {
      const parent = box.node.parent < 0 ? undefined : boxes[box.node.parent]
      const popAt = readAt(config, box.node.line)
      if (parent === undefined || atMs < popAt) {
        return ''
      }
      const grown = easeOut(progress(atMs, popAt, POP_MS))
      const x = parent.x + round(10 * metrics.k)
      const d = `M ${x} ${(parent.y + metrics.nodeH / 2).toFixed(1)} V ${box.y.toFixed(1)} H ${box.x.toFixed(1)}`
      return `<path d="${d}" fill="none" stroke="${theme.border}" stroke-width="${(1.4 * metrics.k).toFixed(2)}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${(1 - grown).toFixed(3)}"/>`
    })
    .join('')
  const shapes = boxes
    .map((box) => {
      const popAt = readAt(config, box.node.line)
      if (atMs < popAt) {
        return ''
      }
      const pop = easeOut(progress(atMs, popAt, POP_MS))
      const finding = config.findings.findIndex((candidate) => candidate.line === box.node.line)
      const fixedAt = finding < 0 ? Number.POSITIVE_INFINITY : (timeline.fixedAt[finding] as number)
      const marked = finding >= 0 && atMs >= readAt(config, box.node.line) && atMs < fixedAt
      const mended = finding >= 0 && atMs >= fixedAt ? 1 - easeInOut(progress(atMs, fixedAt, SETTLE_MS * 2)) : 0
      const ring = marked
        ? theme.tones.warning
        : mended > 0
          ? `color-mix(in srgb, ${theme.tones.success} ${round(mended * 100)}%, ${theme.accent})`
          : theme.accent
      const scale = lerp(0.6, 1, pop)
      const half = metrics.nodeH / 2
      return `<g transform="translate(${box.x} ${box.y.toFixed(1)}) scale(${scale.toFixed(3)})" opacity="${pop.toFixed(3)}">
        <rect x="0" y="${-half}" width="${box.w}" height="${metrics.nodeH}" rx="${round(6 * metrics.k)}" fill="${theme.accentSoft}" stroke="${ring}" stroke-width="${((marked ? 2 : 1.4) * metrics.k).toFixed(2)}"/>
        <text class="md-mono" x="${padX}" y="0" font-size="${metrics.nodePx}" fill="${theme.text.strong}" dominant-baseline="central">${escapeHtml(box.label)}</text>
      </g>`
    })
    .join('')
  const tags = config.findings
    .map((finding, index) => {
      const box = boxes.find((candidate) => candidate.node.line === finding.line)
      const markAt = readAt(config, finding.line)
      if (box === undefined || atMs < markAt) {
        return ''
      }
      const shown = easeOut(progress(atMs, markAt, MARK_MS))
      const fixedAt = timeline.fixedAt[index] as number
      const mended = easeOut(progress(atMs, fixedAt, SETTLE_MS))
      const tone =
        mended > 0 ? `color-mix(in srgb, ${theme.tones.success} ${round(mended * 100)}%, ${theme.tones.warning})` : theme.tones.warning
      const x = box.x + box.w + round(10 * metrics.k) + round((1 - shown) * 6 * metrics.k)
      const checkSize = round(9 * metrics.k)
      const check =
        mended > 0 ? renderCheck({ x: x + checkSize / 2, y: box.y }, checkSize, theme.tones.success, 1.8 * metrics.k, mended) : ''
      const textX = mended > 0 ? x + checkSize + round(5 * metrics.k) : x
      return `<g opacity="${shown.toFixed(3)}">${check}<text class="md-mono" x="${textX.toFixed(1)}" y="${box.y.toFixed(1)}" font-size="${metrics.tagPx}" fill="${tone}" dominant-baseline="central">${escapeHtml(finding.rule)}</text></g>`
    })
    .join('')
  return `${edges}${shapes}${tags}`
}

/**
 * Build the stylesheet for the stage, with the theme resolved into it.
 *
 * @param config - The scene's configuration.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function mendStyles(config: MendConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = mendMetrics(config, profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.md-frame { position: absolute; inset: 0; }
.md-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.md-mono { font-family: ${theme.fonts.mono}; }
.md-line {
  position: absolute;
  display: flex;
  align-items: center;
  height: ${metrics.lineH}px;
  font-family: ${theme.fonts.mono};
  font-size: ${metrics.codePx}px;
  line-height: 1;
  color: ${theme.text.plain};
  white-space: pre;
}
.md-code { white-space: pre; }
.md-head { position: absolute; right: ${metrics.sheet.x}px; top: ${round(16 * metrics.k)}px; display: flex; align-items: center; gap: ${round(metrics.chipPx * 0.5)}px; }
.md-flag {
  font-family: ${theme.fonts.mono};
  font-size: ${metrics.chipPx}px;
  line-height: 1;
  font-weight: 600;
  padding: ${round(metrics.chipPx * 0.28)}px ${round(metrics.chipPx * 0.55)}px;
  border-radius: 999px;
  color: color-mix(in srgb, ${theme.tones.success} var(--md-on), ${theme.text.faint});
  border: 1px solid color-mix(in srgb, ${theme.tones.success} var(--md-on), ${theme.border});
  white-space: nowrap;
}
`
}

/**
 * A file read, marked and mended.
 *
 * A listing sits on a sheet on the left. A beam reads it line by line, and as
 * each line is read its node appears on the right at the same height, nested
 * under the line it belongs to, so the shape the parser makes of the file
 * grows beside the file itself. Where a rule finds something, the span it
 * reports is underlined on the sheet and the rule's id lands beside the node
 * it listens on. When the beam is done the fix flag lights on the command
 * chip, and the fixes land one by one: the span is rewritten in place, its
 * node's label follows, the underline retracts and the tag gets its check.
 * The check beside the file's name is the clean run that follows. Nothing is
 * said in words: the sheet is the file, the nodes are what the package read
 * it as, and the tags are the rules.
 */
export const mendStage: Stage<MendConfig> = defineStage<MendConfig>({
  id: 'mend',

  styles: mendStyles,

  durationMs(config: MendConfig): number {
    return timelineOf(config).settledAt + (config.restMs ?? 1_400)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = mendMetrics(config, profile)
    const timeline = timelineOf(config)
    const flagOn = round(easeOut(progress(atMs, timeline.fixAt, FLAG_MS)) * 100)
    return `<div class="md-frame">
      <svg class="md-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderSheet(config, timeline, metrics, theme, atMs)}
        ${renderBeam(config, timeline, metrics, theme, atMs)}
        ${renderUnderlines(config, timeline, metrics, theme, atMs)}
        ${renderTree(config, timeline, metrics, theme, atMs)}
      </svg>
      ${renderLines(config, timeline, metrics, theme, atMs)}
      <div class="md-head">${renderApiChip(config.command, config.mark)}<span class="md-flag" style="--md-on:${flagOn}%">${escapeHtml(config.fixFlag)}</span></div>
    </div>`
  },
})
