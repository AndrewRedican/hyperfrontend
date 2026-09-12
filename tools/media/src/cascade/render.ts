import type { CascadeConfig, CascadeTone } from '../models/cascade'
import type { MediaTheme } from '../models/theme'
import type { CascadeLayout, CascadeMetrics, Tile } from './layout'
import type { CascadeTimeline, Flight } from './timeline'
import { floor, max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { alongBow, MONO_ADVANCE, monoWidth } from './layout'
import { CARET_LINGER_MS, FLIGHT_MS, GLOW_MS, MORPH_MS } from './timeline'

/** Height of the pill a copy rides on, as a multiple of its font size. */
const PILL_HEIGHT = 1.55

/** How far the glow behind a header span reaches past its characters, at compact size. */
const GLOW_REACH = 4

/** How far a node's halo grows past its rim when it lights, at compact size. */
const HALO_REACH = 8

/** Corner radius of a tile, at compact size. */
const TILE_RADIUS = 6

/** How small a copy has shrunk by the time it has become the value it landed as. */
const ABSORBED_SCALE = 0.55

/** Everything the render helpers need at one instant. */
export interface CascadeFrame {
  /** The cascade as the scene configured it. */
  config: CascadeConfig
  /** Where everything sits. */
  layout: CascadeLayout
  /** Every moment of the cascade. */
  timeline: CascadeTimeline
  /** The measurements this profile is drawn at. */
  metrics: CascadeMetrics
  /** The visual tokens this variant is drawn with. */
  theme: MediaTheme
  /** Offset from the start of the timeline. */
  atMs: number
}

/** Where a run of text is anchored horizontally. */
export type Anchor = 'start' | 'middle'

/** How a run of text is set. */
export interface TextStyle {
  /** Font size. */
  px: number
  /** Fill colour. */
  fill: string
  /** Font weight. */
  weight: number
  /** Horizontal anchor. */
  anchor: Anchor
  /** Whether the run is set in the sans face rather than the mono face. */
  sans?: boolean
  /** Opacity from 0 to 1, or omitted for opaque. */
  opacity?: number
}

/**
 * The colour a tone names in a theme.
 *
 * @param tone - What the value means.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns A colour.
 * @example The warning tone
 * ```ts
 * toneColour('warning', theme) // theme.tones.warning
 * ```
 */
export function toneColour(tone: CascadeTone, theme: MediaTheme): string {
  if (tone === 'accent') {
    return theme.tones.accent
  }
  if (tone === 'warning') {
    return theme.tones.warning
  }
  if (tone === 'success') {
    return theme.tones.success
  }
  return theme.text.strong
}

/**
 * Draw one run of text, vertically centred on its position.
 *
 * @param x - Where it is anchored.
 * @param y - Its vertical centre.
 * @param content - The characters.
 * @param style - How it is set.
 * @returns SVG markup.
 * @example A value in the accent tone
 * ```ts
 * renderText(300, 126, 'major', { px: 12.5, fill: theme.tones.accent, weight: 600, anchor: 'middle' })
 * ```
 */
export function renderText(x: number, y: number, content: string, style: TextStyle): string {
  const opacity = style.opacity === undefined ? '' : ` opacity="${style.opacity.toFixed(3)}"`
  const face = style.sans === true ? 'cs-sans' : 'cs-mono'
  return `<text class="${face}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${style.px}" font-weight="${style.weight}" fill="${style.fill}" text-anchor="${style.anchor}" dominant-baseline="central"${opacity} style="white-space:pre">${escapeHtml(content)}</text>`
}

/**
 * How far down the spine the light has reached.
 *
 * @param frame - The instant being drawn.
 * @returns The vertical position of the lit stretch's end.
 */
function fillYAt(frame: CascadeFrame): number {
  const { layout, timeline, atMs } = frame
  let y = layout.rows[0] ?? 0
  for (const segment of timeline.fill) {
    if (atMs < segment.startAt) {
      continue
    }
    const from = layout.rows[segment.fromRow] ?? y
    const to = layout.rows[segment.toRow] ?? y
    y = max(y, lerp(from, to, easeInOut(progress(atMs, segment.startAt, segment.endAt - segment.startAt))))
  }
  return y
}

/**
 * Draw the spine: the rule down the left of the rows, lit as far as the cascade has got, with a node and a tick at every row.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 * @example The spine at rest
 * ```ts
 * renderSpine({ ...frame, atMs: 0 })
 * ```
 */
export function renderSpine(frame: CascadeFrame): string {
  const { layout, timeline, metrics, theme, atMs } = frame
  const x = metrics.spineXPx
  const top = layout.rows[0] ?? 0
  const bottom = layout.rows[layout.rows.length - 1] ?? top
  const fillY = fillYAt(frame)
  const moving = timeline.fill.some((segment) => atMs >= segment.startAt && atMs < segment.endAt)
  const base = `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="${theme.rule}" stroke-width="1.5"/>`
  const lit =
    fillY > top + 0.5 ? `<line x1="${x}" y1="${top}" x2="${x}" y2="${fillY.toFixed(1)}" stroke="${theme.accent}" stroke-width="2"/>` : ''
  const head = moving
    ? `<circle cx="${x}" cy="${fillY.toFixed(1)}" r="${metrics.nodeRPx * 2.4}" fill="${theme.accent}" opacity="0.22"/><circle cx="${x}" cy="${fillY.toFixed(1)}" r="${metrics.nodeRPx + 1}" fill="${theme.accent}"/>`
    : ''
  const nodes = layout.rows
    .map((rowY, row) => {
      const litAt = row === 0 ? timeline.typedAt : timeline.fill[row - 1]?.endAt
      const on = litAt !== undefined && atMs >= litAt
      const flash = litAt === undefined ? 0 : pulse(atMs, litAt, GLOW_MS)
      const halo =
        flash > 0
          ? `<circle cx="${x}" cy="${rowY}" r="${(metrics.nodeRPx + HALO_REACH * metrics.scale * flash).toFixed(1)}" fill="none" stroke="${theme.accent}" stroke-width="1.5" opacity="${(0.6 * flash).toFixed(3)}"/>`
          : ''
      const tick = `<line x1="${x + metrics.nodeRPx}" y1="${rowY}" x2="${x + metrics.tickPx}" y2="${rowY}" stroke="${on ? theme.accent : theme.rule}" stroke-width="1.5" stroke-linecap="round"/>`
      return `${halo}${tick}<circle cx="${x}" cy="${rowY}" r="${metrics.nodeRPx}" fill="${on ? theme.accent : theme.surface}" stroke="${on ? theme.accent : theme.border}" stroke-width="1.5"/>`
    })
    .join('')
  return `${base}${lit}${nodes}${head}`
}

/**
 * Draw the header line as far as it has been typed, with the caret while it types and a glow on each span a copy is taken from.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 * @example The header fully typed
 * ```ts
 * renderHeader({ ...frame, atMs: 2_000 })
 * ```
 */
export function renderHeader(frame: CascadeFrame): string {
  const { config, layout, timeline, metrics, theme, atMs } = frame
  const y = layout.rows[0] ?? 0
  const characters = config.header.reduce((count, part) => count + part.text.length, 0)
  const typed = min(characters, floor((max(0, atMs - config.typeAtMs) * config.typeCps) / 1000))
  const under: string[] = []
  const texts: string[] = []
  const over: string[] = []
  let consumed = 0
  layout.header.forEach((span, index) => {
    const visible = span.text.slice(0, max(0, typed - consumed))
    consumed += span.text.length
    if (visible.trim() === '') {
      return
    }
    const fill = toneColour(config.header[index]?.tone ?? 'plain', theme)
    texts.push(renderText(span.x, y, visible, { px: metrics.headerPx, fill, weight: 600, anchor: 'start' }))
    const glow = timeline.parse.reduce(
      (strongest, flight) => (flight.sourceIndex === index ? max(strongest, pulse(atMs, flight.departAt, GLOW_MS)) : strongest),
      0
    )
    if (glow > 0) {
      const reach = GLOW_REACH * metrics.scale
      under.push(
        `<rect x="${(span.x - reach).toFixed(1)}" y="${(y - metrics.headerPx * 0.72).toFixed(1)}" width="${(span.width + reach * 2).toFixed(1)}" height="${(metrics.headerPx * 1.44).toFixed(1)}" rx="4" fill="${theme.accentSoft}" opacity="${glow.toFixed(3)}"/>`
      )
      over.push(
        renderText(span.x, y, visible, { px: metrics.headerPx, fill: theme.tones.accent, weight: 600, anchor: 'start', opacity: glow })
      )
    }
  })
  const caret =
    atMs < timeline.typedAt + CARET_LINGER_MS
      ? `<rect x="${(metrics.rowXPx + typed * metrics.headerPx * MONO_ADVANCE).toFixed(1)}" y="${(y - metrics.headerPx * 0.6).toFixed(1)}" width="2" height="${(metrics.headerPx * 1.2).toFixed(1)}" fill="${theme.accent}"/>`
      : ''
  return `${under.join('')}${texts.join('')}${over.join('')}${caret}`
}

/**
 * Draw one tile: dim and empty until its value lands, then raised, and glowing whenever a copy lands on it or is taken from it.
 *
 * @param tile - Where it sits.
 * @param label - The field's name.
 * @param value - The value it holds once landed.
 * @param tone - How the value is coloured.
 * @param landAt - When the value lands.
 * @param takenAt - Every moment a copy is taken from it.
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 * @example The bump tile
 * ```ts
 * renderTile(layout.bump, 'bump', 'major', 'accent', timeline.bumpAt, [timeline.increment.departAt], frame)
 * ```
 */
export function renderTile(
  tile: Tile,
  label: string,
  value: string,
  tone: CascadeTone,
  landAt: number,
  takenAt: readonly number[],
  frame: CascadeFrame
): string {
  const { metrics, theme, atMs } = frame
  const landed = easeOut(progress(atMs, landAt, MORPH_MS))
  const glow = takenAt.reduce((strongest, at) => max(strongest, pulse(atMs, at, GLOW_MS)), pulse(atMs, landAt, GLOW_MS))
  const fill = landed > 0 ? theme.surfaceRaised : theme.surface
  const stroke = glow > 0 ? theme.accent : landed > 0 ? theme.border : theme.rule
  const box = `<rect x="${tile.x}" y="${tile.y}" width="${tile.width}" height="${tile.height}" rx="${TILE_RADIUS * metrics.scale}" fill="${fill}" stroke="${stroke}" stroke-width="${(1.5 + glow).toFixed(2)}"/>`
  const name = renderText(tile.label.x, tile.label.y, label, {
    px: metrics.labelPx,
    fill: theme.text.faint,
    weight: 500,
    anchor: 'middle',
    sans: true,
  })
  if (landed <= 0) {
    return `${box}${name}`
  }
  const scale = lerp(0.8, 1, landed)
  const text = `<g transform="translate(${tile.value.x.toFixed(1)} ${tile.value.y.toFixed(1)}) scale(${scale.toFixed(3)})">${renderText(0, 0, value, { px: metrics.valuePx, fill: toneColour(tone, theme), weight: 600, anchor: 'middle', opacity: landed })}</g>`
  return `${box}${name}${text}`
}

/**
 * Draw the field tiles and the bump tile.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 * @example Every tile filled
 * ```ts
 * renderTiles({ ...frame, atMs: 9_000 })
 * ```
 */
export function renderTiles(frame: CascadeFrame): string {
  const { config, layout, timeline } = frame
  const fields = config.parse.fields
    .map((field, index) => {
      const tile = layout.fields[index]
      const flight = timeline.parse[index]
      if (tile === undefined || flight === undefined) {
        return ''
      }
      const takenAt = [...timeline.bump, ...timeline.changelog]
        .filter((copy) => copy.source === 'field' && copy.sourceIndex === index)
        .map((copy) => copy.departAt)
      return renderTile(tile, field.label, field.value, field.tone ?? 'plain', flight.arriveAt, takenAt, frame)
    })
    .join('')
  const bump = renderTile(
    layout.bump,
    config.bump.label,
    config.bump.value,
    'accent',
    timeline.bumpAt,
    [timeline.increment.departAt],
    frame
  )
  return `${fields}${bump}`
}

/**
 * Draw one copy where it is on its way, shrinking and fading into the value it becomes once it has landed and rested.
 *
 * @param flight - The copy.
 * @param frame - The instant being drawn.
 * @returns SVG markup, or nothing while the copy is not in the air.
 */
function renderFlight(flight: Flight, frame: CascadeFrame): string {
  const { metrics, theme, atMs } = frame
  const restedAt = flight.arriveAt + flight.lingerMs
  if (atMs < flight.departAt || atMs >= restedAt + MORPH_MS) {
    return ''
  }
  const t = easeInOut(progress(atMs, flight.departAt, FLIGHT_MS))
  const point = alongBow(flight.from, flight.to, flight.bow, t)
  const px = lerp(flight.fromPx, flight.toPx, t)
  // why: the copy goes quickly and the value it became fades in behind it, so the swap reads as one thing becoming another rather than two overlapping
  const fade = atMs < restedAt ? 1 : 1 - easeOut(progress(atMs, restedAt, MORPH_MS))
  const shrink = lerp(ABSORBED_SCALE, 1, fade)
  // why: the pill's chrome grows in over the first moments of flight, so a copy leaving the header does not cover the characters beside it before it has moved away
  const chrome = easeOut(min(1, t * 4))
  const width = monoWidth(flight.text, px) + metrics.pillPadPx * 2 * chrome
  const height = px * PILL_HEIGHT
  const fill = flight.tone === 'plain' ? theme.tones.accent : toneColour(flight.tone, theme)
  const pill = `x="${(-width / 2).toFixed(1)}" y="${(-height / 2).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="${(height / 2).toFixed(1)}"`
  return `<g transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)}) scale(${shrink.toFixed(3)})" opacity="${fade.toFixed(3)}"><g opacity="${chrome.toFixed(3)}"><rect ${pill} fill="${theme.surfaceRaised}"/><rect ${pill} fill="${theme.accentSoft}" stroke="${theme.accent}" stroke-width="1.5"/></g>${renderText(0, 0, flight.text, { px, fill, weight: 600, anchor: 'middle' })}</g>`
}

/**
 * Draw every copy that is in the air.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 * @example The first copy half way down
 * ```ts
 * renderFlights({ ...frame, atMs: timeline.parse[0].departAt + 250 })
 * ```
 */
export function renderFlights(frame: CascadeFrame): string {
  const { timeline } = frame
  return [...timeline.parse, ...timeline.bump, timeline.increment, ...timeline.changelog]
    .map((flight) => renderFlight(flight, frame))
    .join('')
}
