import type { MediaTheme } from '../models/theme'
import type { EmbedLayout, Point } from './layout'
import type { EmbedState, RingState } from './timeline'
import { cos, PI, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { lerp } from '../lib/motion'
import { alongPolyline } from './layout'

/** The three segments of the watchdog ring, as start and end angles in degrees clockwise from the wire. */
const RING_SEGMENTS: readonly (readonly [number, number])[] = [
  [8, 112],
  [128, 232],
  [248, 352],
]

/** How far outside the ring the sweep marker runs. */
const SWEEP_OFFSET_PX = 10

/** Height of the gate's doorway. */
const GATE_HEIGHT_PX = 60

/** How far above the wire the doorway starts, so the wire sits in the gap a part-closed shutter leaves. */
const GATE_ABOVE_PX = 48

/** Period of the unsaved marker's pulse. */
const AMBER_PERIOD_MS = 1000

/** How far ahead of a dot its label starts. */
const LABEL_LEAD_PX = 9

/** How far left of the ring's centre the state word is set. */
const WORD_SHIFT_PX = 6

/** Scale the saved document lands at, a step larger than it travelled. */
const LANDED_SCALE = 1.25

/**
 * A point on a circle.
 *
 * @param centre - Where the circle sits.
 * @param radius - Distance from there to the point.
 * @param degrees - Angle clockwise from the positive x axis.
 * @returns Where that angle meets the circle.
 */
function onCircle(centre: Point, radius: number, degrees: number): Point {
  const radians = (degrees * PI) / 180
  return { x: centre.x + radius * cos(radians), y: centre.y + radius * sin(radians) }
}

/**
 * The `d` attribute of an arc.
 *
 * @param centre - The circle's centre.
 * @param radius - Its radius.
 * @param from - Start angle in degrees.
 * @param to - End angle in degrees, greater than the start.
 * @returns A path from the start to the end along the circle.
 */
function arcPath(centre: Point, radius: number, from: number, to: number): string {
  const start = onCircle(centre, radius, from)
  const end = onCircle(centre, radius, to)
  const large = to - from > 180 ? 1 : 0
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${radius} ${radius} 0 ${large} 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
}

/**
 * Draw the wire between the host's lamp and the slot.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the wire.
 */
export function renderWire(layout: EmbedLayout, state: EmbedState, theme: MediaTheme): string {
  const colour =
    state.wire === 'dashed'
      ? theme.border
      : state.wire === 'accent'
        ? theme.accent
        : state.wire === 'warning'
          ? theme.tones.warning
          : theme.rule
  const dash = state.wire === 'dashed' ? ' stroke-dasharray="5 5"' : ''
  return `<line x1="${layout.port.x + 7}" y1="${layout.wireY}" x2="${layout.socket.x - 4}" y2="${layout.wireY}" stroke="${colour}" stroke-width="2.2" stroke-linecap="round"${dash}/>`
}

/**
 * Draw the host's lamp at its end of the wire, and the glow of anything that just arrived.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the lamp.
 */
export function renderPort(layout: EmbedLayout, state: EmbedState, theme: MediaTheme): string {
  const fill = state.lamp === 'success' ? theme.tones.success : state.lamp === 'warning' ? theme.tones.warning : theme.surface
  const stroke = state.lamp === 'idle' ? theme.border : fill
  const glow =
    state.portGlow > 0
      ? `<circle r="${(7 + 9 * state.portGlow).toFixed(1)}" fill="${theme.accent}" opacity="${(0.35 * state.portGlow).toFixed(3)}"/>`
      : ''
  const halo = state.lamp === 'idle' ? '' : `<circle r="9" fill="${fill}" opacity="0.22"/>`
  return `<g transform="translate(${layout.port.x} ${layout.port.y})">${glow}${halo}<circle r="5" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/></g>`
}

/**
 * Draw the socket on the seated feature's edge, and the glow of anything that just arrived.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the socket, or nothing while no feature is seated.
 */
export function renderSocket(layout: EmbedLayout, state: EmbedState, theme: MediaTheme): string {
  if (state.seat < 1 || state.presence <= 0) {
    return ''
  }
  const glow =
    state.socketGlow > 0
      ? `<circle r="${(7 + 9 * state.socketGlow).toFixed(1)}" fill="${theme.accent}" opacity="${(0.35 * state.socketGlow).toFixed(3)}"/>`
      : ''
  return `<g transform="translate(${layout.socket.x} ${layout.socket.y})" opacity="${state.presence.toFixed(3)}">${glow}<circle r="3.5" fill="${theme.surface}" stroke="${state.linked ? theme.accent : theme.border}" stroke-width="1.5"/></g>`
}

/**
 * Draw every dot in flight along the wire, with any label riding above it.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the dots.
 */
export function renderFlights(layout: EmbedLayout, state: EmbedState, theme: MediaTheme): string {
  return state.flights
    .map(({ flight, t }) => {
      const from = flight.from === 'host' ? layout.port.x : layout.socket.x
      const to = flight.from === 'host' ? layout.socket.x : layout.port.x
      const x = lerp(from, to, t).toFixed(1)
      const y = layout.wireY
      const colour = flight.tone === 'warning' ? theme.tones.warning : theme.accent
      if (flight.size === 'beat') {
        return `<circle cx="${x}" cy="${y}" r="3" fill="${colour}"/>`
      }
      // why: the label leads the dot toward its destination, so it never sits over the window it just left
      const anchor = flight.from === 'host' ? 'start' : 'end'
      const labelX = (lerp(from, to, t) + (flight.from === 'host' ? LABEL_LEAD_PX : -LABEL_LEAD_PX)).toFixed(1)
      const label =
        flight.label === undefined
          ? ''
          : `<text x="${labelX}" y="${y - 13}" class="em-text em-label" text-anchor="${anchor}">${escapeHtml(flight.label)}</text>`
      return `<circle cx="${x}" cy="${y}" r="11" fill="${colour}" opacity="0.2"/><circle cx="${x}" cy="${y}" r="5" fill="${colour}"/>${label}`
    })
    .join('')
}

/**
 * Draw the shutter across the wire and the doorway it runs in.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the gate, or nothing while the script has none.
 */
export function renderGate(layout: EmbedLayout, state: EmbedState, theme: MediaTheme): string {
  const gate = state.gate
  if (gate === undefined || gate.reveal <= 0) {
    return ''
  }
  const x = layout.gateX
  const top = layout.wireY - GATE_ABOVE_PX
  const floor = top + GATE_HEIGHT_PX
  const shutterHeight = GATE_HEIGHT_PX * gate.descent
  const frame = `<path d="M ${x - 11} ${top} V ${floor} M ${x + 11} ${top} V ${floor} M ${x - 13} ${top} H ${x + 13} M ${x - 11} ${floor} H ${x + 11}" fill="none" stroke="${theme.text.faint}" stroke-width="1.5" stroke-linecap="round"/>`
  if (shutterHeight <= 0) {
    return `<g opacity="${gate.reveal.toFixed(3)}">${frame}</g>`
  }
  const slats: string[] = []
  for (let offset = 6; offset < shutterHeight - 2; offset += 6) {
    slats.push(`M ${x - 6} ${(top + offset).toFixed(1)} H ${x + 6}`)
  }
  const edge = gate.closed ? theme.border : theme.tones.warning
  return `<g opacity="${gate.reveal.toFixed(3)}">${frame}<rect x="${x - 9}" y="${top}" width="18" height="${shutterHeight.toFixed(1)}" rx="2" fill="${theme.surfaceRaised}" stroke="${edge}" stroke-width="1.5"/><path d="${slats.join(' ')}" fill="none" stroke="${theme.border}" stroke-width="1.2"/></g>`
}

/**
 * The colour the ring's word is set in.
 *
 * @param ring - The ring's state.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns A colour token.
 */
function wordColour(ring: RingState, theme: MediaTheme): string {
  if (ring.word === 'healthy') {
    return theme.tones.success
  }
  if (ring.word === 'suspect') {
    return theme.tones.danger
  }
  return theme.text.muted
}

/**
 * Draw the watchdog ring: the miss budget as three segments, the sweep between ticks, and the state word.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the ring, or nothing while the script has none.
 */
export function renderRing(layout: EmbedLayout, state: EmbedState, theme: MediaTheme): string {
  const ring = state.ring
  if (ring === undefined) {
    return ''
  }
  const centre = layout.ringCentre
  const radius = layout.ringRadius
  const segments = RING_SEGMENTS.map(([from, to], index) => {
    const base = `<path d="${arcPath(centre, radius, from, to)}" fill="none" stroke="${theme.border}" stroke-width="4" stroke-linecap="round"/>`
    if (index >= ring.filled) {
      return base
    }
    const share = index === ring.filled - 1 ? ring.fill : 1
    const colour = ring.danger ? theme.tones.danger : theme.tones.warning
    return `${base}<path d="${arcPath(centre, radius, from, from + (to - from) * share)}" fill="none" stroke="${colour}" stroke-width="4.5" stroke-linecap="round"/>`
  }).join('')
  const marker = onCircle(centre, radius + SWEEP_OFFSET_PX, -90 + 360 * ring.sweep)
  const tickAt = onCircle(centre, radius + SWEEP_OFFSET_PX, -90)
  const blink =
    ring.blink > 0
      ? `<circle cx="${tickAt.x.toFixed(1)}" cy="${tickAt.y.toFixed(1)}" r="${(2.5 + 2.5 * ring.blink).toFixed(1)}" fill="${theme.text.plain}" opacity="${(0.9 * ring.blink).toFixed(3)}"/>`
      : ''
  // why: the lamp sits on the ring's right rim, so the word is centred a step left of the ring to clear it
  const word =
    ring.word === undefined
      ? ''
      : `<text x="${centre.x - WORD_SHIFT_PX}" y="${centre.y}" class="em-text em-word" fill="${wordColour(ring, theme)}" text-anchor="middle" dominant-baseline="central">${escapeHtml(ring.word)}</text>`
  return `${segments}<circle cx="${marker.x.toFixed(1)}" cy="${marker.y.toFixed(1)}" r="2.5" fill="${theme.text.faint}"/>${blink}${word}`
}

/**
 * Draw the draft document: inside the feature, crossing the wire, or landed in the host as saved.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline, for the marker's pulse.
 * @returns SVG markup for the document, or nothing while the script has none.
 */
export function renderDraft(layout: EmbedLayout, state: EmbedState, theme: MediaTheme, atMs: number): string {
  const draft = state.draft
  if (draft === undefined) {
    return ''
  }
  const path: readonly Point[] = [layout.draftAt, { x: layout.socket.x - 2, y: layout.wireY }, layout.port, layout.landing]
  const landed = draft.travel !== undefined && draft.travel >= 1
  let at = layout.draftAt
  let opacity = 1
  let scale = 1
  if (draft.travel === undefined) {
    opacity = state.presence * (1 - 0.55 * state.dim)
  } else if (landed) {
    at = layout.landing
    scale = LANDED_SCALE * (0.7 + 0.3 * draft.saved)
  } else {
    at = alongPolyline(path, draft.travel)
  }
  if (opacity <= 0) {
    return ''
  }
  const wave = 0.5 + 0.5 * sin(((atMs % AMBER_PERIOD_MS) / AMBER_PERIOD_MS) * 2 * PI)
  const marker = draft.dirty ? `<circle cx="8" cy="-10" r="${(3 + 1.2 * wave).toFixed(2)}" fill="${theme.tones.warning}"/>` : ''
  const inside = landed
    ? `<path d="M -4 1 L -1 4 L 5 -3" fill="none" stroke="${theme.tones.success}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M -4 -1 H 4 M -4 3 H 4 M -4 7 H 1" fill="none" stroke="${theme.text.faint}" stroke-width="1.5" stroke-linecap="round"/>`
  const outline = landed ? theme.tones.success : theme.text.muted
  return `<g transform="translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) scale(${scale.toFixed(3)})" opacity="${opacity.toFixed(3)}"><path d="M -8 -10 H 3 L 8 -5 V 10 H -8 Z" fill="${theme.surfaceRaised}" stroke="${outline}" stroke-width="1.5" stroke-linejoin="round"/><path d="M 3 -10 V -5 H 8" fill="none" stroke="${outline}" stroke-width="1.5" stroke-linejoin="round"/>${inside}${marker}</g>`
}
