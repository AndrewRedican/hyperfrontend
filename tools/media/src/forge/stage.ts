import type { ForgeConfig } from '../models/forge'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { CardLayout, ForgeLayout, ForgeMetrics, Point } from './layout'
import type { EntrySchedule, ForgeTimeline } from './timeline'
import { cos, max, PI, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeIn, easeInOut, easeOut, progress } from '../lib/motion'
import { apiChipStyles, renderApiChip } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { cubicAt, cubicPath, cubicPrefix, forgeLayout, forgeMetrics, streamCurve, wireCurve } from './layout'
import { renderBuilder, renderCard, renderFolderLabel, renderSheet, renderTile } from './render'
import { BRACKET_MS, CLUSTER_FADE_MS, CONNECTOR_MS, DOTS_PER_STREAM, forgeTimeline, SHEET_MS, TRAVEL_MS, WIRE_MS } from './timeline'

/** How long one turn of the dots gathered inside the builder takes. */
const CLUSTER_TURN_MS = 1_600

/** How long the builder takes to light once an entry arrives, and to dim once it is empty. */
const GLOW_MS = 300

/**
 * Where one of an entry's dots sits inside the builder at one instant.
 *
 * The three dots turn slowly about the cluster's centre while the entry is
 * being built, which is the one motion that says the builder is working on
 * what it holds.
 *
 * @param layout - Where everything sits.
 * @param dot - Which dot of the stream.
 * @param atMs - Offset from the start of the timeline.
 * @returns The dot's position.
 */
function clusterSlot(layout: ForgeLayout, dot: number, atMs: number): Point {
  const angle = (atMs / CLUSTER_TURN_MS) * 2 * PI + (dot / DOTS_PER_STREAM) * 2 * PI - PI / 2
  return { x: layout.cluster.x + cos(angle) * layout.clusterRadius, y: layout.cluster.y + sin(angle) * layout.clusterRadius }
}

/**
 * How brightly the builder is working at one instant.
 *
 * @param timeline - Every moment on the timeline.
 * @param atMs - Offset from the start of the timeline.
 * @returns Intensity from 0 to 1.
 */
function glowAt(timeline: ForgeTimeline, atMs: number): number {
  let glow = 0
  for (const entry of timeline.entries) {
    const rising = easeOut(progress(atMs, entry.workStart, GLOW_MS))
    const falling = 1 - easeIn(progress(atMs, entry.workEnd, GLOW_MS))
    glow = max(glow, rising * falling)
  }
  return glow
}

/**
 * Draw one entry's dots: waiting at the card, streaming into the builder, or
 * turning inside it until its last file has landed.
 *
 * @param card - The card the stream leaves from.
 * @param schedule - When the entry's dots leave and when it is done.
 * @param layout - Where everything sits.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the dots.
 */
function renderStream(
  card: CardLayout,
  schedule: EntrySchedule,
  layout: ForgeLayout,
  metrics: ForgeMetrics,
  theme: MediaTheme,
  atMs: number
): string {
  const fade = 1 - easeIn(progress(atMs, schedule.workEnd, CLUSTER_FADE_MS))
  if (fade <= 0) {
    return ''
  }
  return card.queue
    .map((slot, dot) => {
      const leaveAt = schedule.leaveAt[dot] ?? 0
      let at = slot
      if (atMs >= leaveAt) {
        const t = easeInOut(progress(atMs, leaveAt, TRAVEL_MS))
        // why: the dot aims for where its slot will be when it arrives, then turns with the cluster from there, so the arrival is one continuous motion
        const target = t < 1 ? clusterSlot(layout, dot, leaveAt + TRAVEL_MS) : clusterSlot(layout, dot, atMs)
        const [p0, p1, p2, p3] = streamCurve(slot, target)
        at = cubicAt(p0, p1, p2, p3, t)
      }
      return `<circle cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="${metrics.dotPx}" fill="${theme.accent}" opacity="${fade.toFixed(3)}"/>`
    })
    .join('')
}

/**
 * Draw every wire from a file to its key, as far as each has got.
 *
 * @param layout - Where everything sits.
 * @param timeline - Every moment on the timeline.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the wires and their landings.
 */
function renderWires(layout: ForgeLayout, timeline: ForgeTimeline, metrics: ForgeMetrics, theme: MediaTheme, atMs: number): string {
  return timeline.wires
    .map((wire) => {
      const tile = layout.tiles[wire.tile]
      const key = layout.keys.find((candidate) => candidate.key === wire.key)
      if (tile === undefined || key === undefined || atMs < wire.startAt) {
        return ''
      }
      const t = easeInOut(progress(atMs, wire.startAt, WIRE_MS))
      // why: the wires into one key land side by side along its top edge rather than on one point, so a reader can count them
      const spread = (wire.ordinal - (wire.siblings - 1) / 2) * 7
      const landing = { x: key.top.x + spread, y: key.top.y }
      const [p0, p1, p2, p3] = wireCurve(tile.port, landing)
      const path = cubicPath(cubicPrefix(p0, p1, p2, p3, t))
      const landed = t >= 1 ? easeOut(progress(atMs, wire.landAt, 200)) : 0
      const dot =
        landed <= 0
          ? ''
          : `<circle cx="${landing.x.toFixed(1)}" cy="${landing.y.toFixed(1)}" r="${(2.5 * landed).toFixed(2)}" fill="${theme.accent}"/>`
      return `<path d="${path}" fill="none" stroke="${theme.accent}" stroke-width="${metrics.strokePx}" stroke-dasharray="4 3" stroke-linecap="round" opacity="0.85"/>${dot}`
    })
    .join('')
}

/**
 * Draw the bracket that spans every file, and its tail into the key that
 * lists them all.
 *
 * @param layout - Where everything sits.
 * @param timeline - Every moment on the timeline.
 * @param spanKey - The key the bracket feeds.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup, or nothing before the bracket starts.
 */
function renderBracket(
  layout: ForgeLayout,
  timeline: ForgeTimeline,
  spanKey: string,
  metrics: ForgeMetrics,
  theme: MediaTheme,
  atMs: number
): string {
  if (atMs < timeline.bracketAt) {
    return ''
  }
  const { bracket } = layout
  const drawn = easeInOut(progress(atMs, timeline.bracketAt, BRACKET_MS))
  const spine = `M ${bracket.x - bracket.tick} ${bracket.top} H ${bracket.x} V ${bracket.bottom} H ${bracket.x - bracket.tick}`
  const spinePath = `<path d="${spine}" fill="none" stroke="${theme.accent}" stroke-width="${metrics.strokePx}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${(1 - drawn).toFixed(3)}" opacity="0.85"/>`
  const key = layout.keys.find((candidate) => candidate.key === spanKey)
  if (key === undefined || atMs < timeline.connectorAt) {
    return spinePath
  }
  const reach = easeInOut(progress(atMs, timeline.connectorAt, CONNECTOR_MS))
  const start = { x: bracket.x, y: bracket.bottom }
  const drop = max(1, key.top.y - bracket.bottom) * 0.55
  const path = cubicPath(
    cubicPrefix(start, { x: bracket.x, y: bracket.bottom + drop }, { x: key.top.x, y: key.top.y - drop }, key.top, reach)
  )
  const landed = reach >= 1 ? easeOut(progress(atMs, timeline.connectorAt + CONNECTOR_MS, 200)) : 0
  const dot =
    landed <= 0
      ? ''
      : `<circle cx="${key.top.x.toFixed(1)}" cy="${key.top.y.toFixed(1)}" r="${(2.5 * landed).toFixed(2)}" fill="${theme.accent}"/>`
  return `${spinePath}<path d="${path}" fill="none" stroke="${theme.accent}" stroke-width="${metrics.strokePx}" stroke-dasharray="4 3" stroke-linecap="round" opacity="0.85"/>${dot}`
}

/**
 * Build the stylesheet for one forge, with its theme resolved into it.
 *
 * @param config - The forge as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function forgeStyles(config: ForgeConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = forgeMetrics(profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.fg-frame { position: absolute; inset: 0; }
.fg-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.fg-chip { position: absolute; transform: translate(-50%, -50%); }
.fg-label { font-family: ${theme.fonts.mono}; font-size: ${metrics.labelPx}px; fill: ${theme.text.muted}; }
.fg-card-name { font-family: ${theme.fonts.mono}; font-size: ${metrics.cardPx}px; font-weight: 600; fill: ${theme.text.strong}; }
.fg-name { font-family: ${theme.fonts.mono}; font-size: ${metrics.namePx}px; fill: ${theme.text.plain}; }
.fg-pill { font-family: ${theme.fonts.mono}; font-size: ${metrics.pillPx}px; font-weight: 700; }
.fg-key { font-family: ${theme.fonts.mono}; font-size: ${metrics.pillPx}px; font-weight: 500; }
.fg-key--lit { font-weight: 700; }
`
}

/**
 * A forge with a mirror.
 *
 * Source entries wait at their cards on the left; one at a time, an entry
 * streams into the builder, turns inside it while it is built, and its files
 * pop into the tree on the right, each on a thread from the builder. Once
 * every entry has been through, the manifest rises from below and wires draw
 * from the files to the keys they produced, ending with a bracket down the
 * side of the whole tree into the key that lists every file. The manifest is
 * visibly a reflection of what landed, drawn rather than printed.
 */
export const forgeStage: Stage<ForgeConfig> = defineStage<ForgeConfig>({
  id: 'forge',

  styles: forgeStyles,

  durationMs(config: ForgeConfig): number {
    return forgeTimeline(config).settledAt
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = forgeMetrics(profile)
    const layout = forgeLayout(config, profile, metrics)
    const timeline = forgeTimeline(config)
    const glow = glowAt(timeline, atMs)
    const cards = config.entries
      .map((entry, index) => {
        const card = layout.cards[index]
        return card === undefined ? '' : renderCard(card, entry.name, metrics, theme)
      })
      .join('')
    const tiles = layout.tiles
      .map((tile) => {
        const output = config.entries[tile.entry]?.outputs[tile.output]
        const popAt = timeline.entries[tile.entry]?.popAt[tile.output]
        return output === undefined || popAt === undefined ? '' : renderTile(tile, output, popAt, layout.emit, metrics, theme, atMs)
      })
      .join('')
    const streams = layout.cards
      .map((card, index) => {
        const schedule = timeline.entries[index]
        return schedule === undefined ? '' : renderStream(card, schedule, layout, metrics, theme, atMs)
      })
      .join('')
    const rise = easeOut(progress(atMs, timeline.sheetAt, SHEET_MS))
    return `<div class="fg-frame">
      <svg class="fg-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderFolderLabel(layout.sourceLabel, config.sourceDir, metrics, theme)}
        ${renderFolderLabel(layout.outputLabel, config.outputDir, metrics, theme)}
        ${cards}
        ${renderWires(layout, timeline, metrics, theme, atMs)}
        ${renderBracket(layout, timeline, config.manifest.spanKey, metrics, theme, atMs)}
        ${renderSheet(layout, config.manifest.name, rise, timeline.keyLitAt, metrics, theme, atMs)}
        ${renderBuilder(layout, glow, metrics, theme)}
        ${tiles}
        ${streams}
      </svg>
      <div class="fg-chip" style="left:${layout.chip.x}px;top:${layout.chip.y}px">${renderApiChip(config.api.name, config.api.mark)}</div>
    </div>`
  },
})
