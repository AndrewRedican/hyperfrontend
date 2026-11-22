import type { HairpinConfig } from '../models/hairpin'
import type { MediaTheme } from '../models/theme'
import type { HairpinLayout } from './layout'
import type { HairpinTimeline } from './timeline'
import type { Token } from './token'
import { cos, max, PI, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { shellPath, turnPath } from './layout'
import { ALERT_MS, BOOT_MS, DARK_MS, DARK_STAGGER_MS, DOOR_MS, EXIT_MS, LAND_MS, SIGNAL_MS } from './timeline'
import { bandMoments, nearness } from './token'

/** How far the leaf of the way in swings from the wall when it is open, in radians. */
const OPEN_ANGLE = (PI * 74) / 180

/** How long the ring on the closed way in lasts when a request comes up against it. */
const KNOCK_MS = 560

/** How long a pane stays lit after it has marked a returning value. */
const MARK_MS = 600

/** How long a turn stays lit after a value has left it. */
const TURN_FADE_MS = 420

/** Everything the render helpers need at one instant. */
export interface HairpinFrame {
  /** The service as the scene configured it. */
  config: HairpinConfig
  /** Where everything sits. */
  layout: HairpinLayout
  /** Every moment of the stage. */
  timeline: HairpinTimeline
  /** The visual tokens this variant is drawn with. */
  theme: MediaTheme
  /** Offset from the start of the timeline. */
  atMs: number
  /** Every request and response in the frame at this instant. */
  tokens: readonly Token[]
}

/**
 * How alive the process is.
 *
 * It lights at the start of the loop and goes dark once the last response in
 * flight has left, so the frame the loop ends on is the frame it starts from:
 * a process that has ended, about to be started again.
 *
 * @param timeline - Every moment of the stage.
 * @param atMs - Offset from the start of the timeline.
 * @param lagMs - How much later than the process itself this part of it goes dark.
 * @returns 0 for dark, 1 for running.
 */
export function liveAt(timeline: HairpinTimeline, atMs: number, lagMs = 0): number {
  return easeOut(progress(atMs, 0, BOOT_MS)) * (1 - easeInOut(progress(atMs, timeline.darkAt + lagMs, DARK_MS)))
}

/**
 * How much of the last run is still showing at the start of the loop.
 *
 * @param atMs - Offset from the start of the timeline.
 * @returns 1 on the first frame, 0 once the process has started again.
 */
export function afterglowAt(atMs: number): number {
  return 1 - easeOut(progress(atMs, 0, BOOT_MS))
}

/**
 * How far open the way in is.
 *
 * @param timeline - Every moment of the stage.
 * @param atMs - Offset from the start of the timeline.
 * @returns 0 for shut, 1 for open.
 */
function openAt(timeline: HairpinTimeline, atMs: number): number {
  return easeInOut(progress(atMs, 80, BOOT_MS - 80)) * (1 - easeInOut(progress(atMs, timeline.stopAt, DOOR_MS)))
}

/**
 * Draw the ground the process stands on, under everything inside it.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 */
export function renderGround(frame: HairpinFrame): string {
  const { layout, timeline, theme, atMs } = frame
  const { shell } = layout
  return `<rect x="${shell.x.toFixed(1)}" y="${shell.y.toFixed(1)}" width="${shell.w.toFixed(1)}" height="${shell.h.toFixed(1)}" rx="${layout.shellRadius.toFixed(1)}" fill="${theme.surface}" opacity="${(0.25 + 0.3 * liveAt(timeline, atMs)).toFixed(3)}"/>`
}

/**
 * Draw the wall of the process, with its two openings and the leaf on the way in.
 *
 * The leaf hangs from the top of the upper opening. Open, it is swung into
 * the process and the lane runs past it; on the stop it swings shut across
 * the opening and takes the warning tone, while the lower opening, which has
 * no leaf, stays as it was: nothing more comes in, and what is inside can
 * still leave.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 */
export function renderShell(frame: HairpinFrame): string {
  const { layout, timeline, theme, atMs } = frame
  const { shell, unit } = layout
  const live = liveAt(timeline, atMs)
  const open = openAt(timeline, atMs)
  const d = shellPath(layout)
  const hingeY = layout.inY - layout.doorHalf
  const tipX = shell.x + 2 * layout.doorHalf * sin(OPEN_ANGLE * open)
  const tipY = hingeY + 2 * layout.doorHalf * cos(OPEN_ANGLE * open)
  const leaf = `x1="${shell.x.toFixed(1)}" y1="${hingeY.toFixed(1)}" x2="${tipX.toFixed(1)}" y2="${tipY.toFixed(1)}" stroke-width="${(3.4 * unit).toFixed(1)}" stroke-linecap="round"`
  const jambs = [layout.inY - layout.doorHalf, layout.inY + layout.doorHalf, layout.outY - layout.doorHalf, layout.outY + layout.doorHalf]
    .map((y) => `<circle cx="${shell.x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2.4 * unit).toFixed(1)}" fill="${theme.text.muted}"/>`)
    .join('')
  const knocks = timeline.trips
    .filter((trip) => trip.refused && atMs >= trip.doorAt && atMs < trip.doorAt + KNOCK_MS)
    .map((trip) => {
      const spread = easeOut(progress(atMs, trip.doorAt, KNOCK_MS))
      return `<circle cx="${shell.x.toFixed(1)}" cy="${layout.inY.toFixed(1)}" r="${((7 + 13 * spread) * unit).toFixed(1)}" fill="none" stroke="${theme.tones.warning}" stroke-width="${(1.6 * unit).toFixed(1)}" opacity="${(0.75 * (1 - spread)).toFixed(3)}"/>`
    })
    .join('')
  // why: a process that has ended keeps its outline, dashed, so the loop has somewhere to start again from
  const dash = live < 0.5 ? ` stroke-dasharray="${(5 * unit).toFixed(1)} ${(5 * unit).toFixed(1)}"` : ''
  return `<path d="${d}" fill="none" stroke="${theme.border}" stroke-width="${(1.8 * unit).toFixed(1)}" stroke-linecap="round"${dash}/>
    <path d="${d}" fill="none" stroke="${theme.borderActive}" stroke-width="${(1.8 * unit).toFixed(1)}" stroke-linecap="round" opacity="${(0.55 * live).toFixed(3)}"${dash}/>
    <path d="${d}" fill="none" stroke="${theme.tones.warning}" stroke-width="${(2.6 * unit).toFixed(1)}" stroke-linecap="round" opacity="${(0.9 * pulse(atMs, timeline.stopAt, ALERT_MS)).toFixed(3)}"/>
    ${jambs}
    <line ${leaf} stroke="${theme.text.muted}"/>
    <line ${leaf} stroke="${theme.tones.warning}" opacity="${(1 - open).toFixed(3)}"/>
    ${knocks}`
}

/**
 * Draw the steps as panes, each lit while something is inside it.
 *
 * A pane lights in the accent for anything passing through it, in either
 * direction, and flashes in the brighter tone at the moment it marks a value
 * on its way back. When the process ends the panes go dark one after
 * another, the innermost first: the order the last value left them in.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 */
export function renderPanes(frame: HairpinFrame): string {
  const { config, layout, timeline, theme, atMs, tokens } = frame
  const { unit } = layout
  return layout.panes
    .map((pane, index) => {
      const live = liveAt(timeline, atMs, (layout.panes.length - 1 - index) * DARK_STAGGER_MS)
      const glow = tokens.reduce((strongest, token) => max(strongest, nearness(token, pane.centreX, pane.rect.w)), 0)
      const mark = timeline.trips.reduce(
        (strongest, trip) =>
          bandMoments(trip, config, layout, timeline).reduce(
            (inner, moment) => (moment.step === index ? max(inner, pulse(atMs, moment.atMs - 80, MARK_MS)) : inner),
            strongest
          ),
        0
      )
      const box = `x="${pane.rect.x.toFixed(1)}" y="${pane.rect.y.toFixed(1)}" width="${pane.rect.w.toFixed(1)}" height="${pane.rect.h.toFixed(1)}" rx="${(13 * unit).toFixed(1)}"`
      return `<rect ${box} fill="${theme.surfaceRaised}" opacity="${(0.3 + 0.7 * live).toFixed(3)}"/>
        <rect ${box} fill="${theme.accent}" opacity="${(0.13 * glow + 0.1 * mark).toFixed(3)}"/>
        <rect ${box} fill="none" stroke="${theme.border}" stroke-width="${(1.5 * unit).toFixed(1)}"/>
        <rect ${box} fill="none" stroke="${theme.accent}" stroke-width="${((1.5 + 0.9 * glow) * unit).toFixed(2)}" opacity="${(0.22 * live + 0.78 * glow).toFixed(3)}"/>
        <rect ${box} fill="none" stroke="${theme.text.strong}" stroke-width="${(2.2 * unit).toFixed(1)}" opacity="${(0.85 * mark).toFixed(3)}"/>`
    })
    .join('')
}

/**
 * Draw the two lanes and the turn inside every pane.
 *
 * The lane in runs along the top from the way in to the last step, the lane
 * out comes back along the bottom, and inside each pane a half circle joins
 * the two. The last one is where the lanes end. The others are dashed: every
 * step may answer, and the turn it would answer through is drawn whether or
 * not anything takes it. A turn lights while a request is on it.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 */
export function renderLanes(frame: HairpinFrame): string {
  const { layout, timeline, theme, atMs } = frame
  const { unit } = layout
  const last = layout.panes[layout.panes.length - 1]
  if (last === undefined) {
    return ''
  }
  const stroke = `fill="none" stroke="${theme.text.faint}" stroke-width="${(1.5 * unit).toFixed(1)}" stroke-linecap="round"`
  const lanes = [layout.inY, layout.outY]
    .map(
      (y) => `<line x1="${layout.shell.x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${last.turnX.toFixed(1)}" y2="${y.toFixed(1)}" ${stroke}/>`
    )
    .join('')
  const turns = layout.panes
    .map((pane, index) => {
      const lit = timeline.trips.reduce(
        (strongest, trip) =>
          !trip.refused && trip.step === index
            ? max(strongest, progress(atMs, trip.turnAt, 140) * (1 - progress(atMs, trip.turnedAt, TURN_FADE_MS)))
            : strongest,
        0
      )
      const dash = pane === last ? '' : ` stroke-dasharray="${(2.5 * unit).toFixed(1)} ${(4.5 * unit).toFixed(1)}"`
      const d = turnPath(layout, pane.turnX)
      return `<path d="${d}" ${stroke}${dash}/><path d="${d}" fill="none" stroke="${theme.accent}" stroke-width="${(2.2 * unit).toFixed(1)}" stroke-linecap="round" opacity="${lit.toFixed(3)}"/>`
    })
    .join('')
  // why: outside the process the lanes are only dotted, and one chevron on each says which way it runs, so a still frame reads the same way the motion does
  const approach = [layout.inY, layout.outY]
    .map(
      (y) =>
        `<line x1="0" y1="${y.toFixed(1)}" x2="${(layout.shell.x - 9 * unit).toFixed(1)}" y2="${y.toFixed(1)}" ${stroke} stroke-dasharray="${(1.5 * unit).toFixed(1)} ${(6 * unit).toFixed(1)}"/>`
    )
    .join('')
  const chevronX = (layout.shell.x + (layout.panes[0]?.rect.x ?? layout.shell.x)) / 2
  const chevrons = [
    { y: layout.inY, turn: 0 },
    { y: layout.outY, turn: 180 },
  ]
    .map(
      (lane) =>
        `<path d="M ${(-3 * unit).toFixed(1)} ${(-4.5 * unit).toFixed(1)} L ${(2.5 * unit).toFixed(1)} 0 L ${(-3 * unit).toFixed(1)} ${(4.5 * unit).toFixed(1)}" ${stroke} stroke-linejoin="round" transform="translate(${chevronX.toFixed(1)} ${lane.y.toFixed(1)}) rotate(${lane.turn})"/>`
    )
    .join('')
  return `${approach}<g opacity="${lerp(0.4, 1, liveAt(timeline, atMs)).toFixed(3)}">${lanes}${chevrons}${turns}</g>`
}

/**
 * Draw every request and response.
 *
 * A request is a ring with nothing in it; a response is the same ring filled.
 * Each band a value gained on its way back closes round it as one more ring,
 * so what leaves the process can be told from what a step first returned.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 */
export function renderTokens(frame: HairpinFrame): string {
  const { layout, theme, tokens } = frame
  const { unit, tokenR } = layout
  return tokens
    .map((token) => {
      const centre = `cx="${token.at.x.toFixed(1)}" cy="${token.at.y.toFixed(1)}"`
      const bands = token.bands
        .map((band, index) => {
          const r = tokenR + (4.6 * (index + 1) + 5 * (1 - band)) * unit
          return `<circle ${centre} r="${r.toFixed(2)}" fill="none" stroke="${theme.text.strong}" stroke-width="${(2.2 * unit).toFixed(1)}" opacity="${band.toFixed(3)}"/>`
        })
        .join('')
      return `<g opacity="${token.opacity.toFixed(3)}"><circle ${centre} r="${tokenR.toFixed(1)}" fill="${theme.surfaceRaised}" stroke="${theme.accent}" stroke-width="${(2.4 * unit).toFixed(1)}"/><circle ${centre} r="${tokenR.toFixed(1)}" fill="${theme.accent}" opacity="${token.filled.toFixed(3)}"/>${bands}</g>`
    })
    .join('')
}

/**
 * Draw the wire the process is supervised over, and what travels it.
 *
 * The wire hangs from the runner's chip to an empty slot. The signal climbs
 * it in the warning tone; much later, when the process has gone dark, the
 * exit code comes down it in the success tone and lands in the slot as a
 * numeral. The slot keeps the code through the first moments of the next
 * loop, which is the supervisor having read it and started the process again.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 */
export function renderSupervisor(frame: HairpinFrame): string {
  const { config, layout, timeline, theme, atMs } = frame
  const { unit, slot, wireTop, wireFoot } = layout
  const landed = max(afterglowAt(atMs), easeOut(progress(atMs, timeline.landAt, 280)))
  const ring = pulse(atMs, timeline.landAt, LAND_MS)
  const box = (grow: number): string =>
    `x="${(slot.x - grow).toFixed(1)}" y="${(slot.y - grow).toFixed(1)}" width="${(slot.w + 2 * grow).toFixed(1)}" height="${(slot.h + 2 * grow).toFixed(1)}" rx="${(8 * unit + grow).toFixed(1)}"`
  const rising = progress(atMs, timeline.signalAt, SIGNAL_MS)
  const signal =
    atMs >= timeline.signalAt && atMs < timeline.stopAt
      ? `<circle cx="${wireFoot.x.toFixed(1)}" cy="${lerp(wireFoot.y, wireTop.y, easeInOut(rising)).toFixed(1)}" r="${(4.4 * unit).toFixed(1)}" fill="${theme.tones.warning}"/>`
      : ''
  const falling = progress(atMs, timeline.exitAt, EXIT_MS)
  const code =
    atMs >= timeline.exitAt && atMs < timeline.landAt
      ? `<circle cx="${wireTop.x.toFixed(1)}" cy="${lerp(wireTop.y, wireFoot.y, easeInOut(falling)).toFixed(1)}" r="${(4.8 * unit).toFixed(1)}" fill="${theme.tones.success}"/>`
      : ''
  return `<line x1="${wireTop.x.toFixed(1)}" y1="${wireTop.y.toFixed(1)}" x2="${wireFoot.x.toFixed(1)}" y2="${wireFoot.y.toFixed(1)}" stroke="${theme.text.faint}" stroke-width="${(1.5 * unit).toFixed(1)}" stroke-dasharray="${(2.5 * unit).toFixed(1)} ${(4.5 * unit).toFixed(1)}" stroke-linecap="round"/>
    <rect ${box(0)} fill="${theme.surface}" stroke="${theme.text.faint}" stroke-width="${(1.5 * unit).toFixed(1)}" stroke-dasharray="${(4 * unit).toFixed(1)} ${(3.5 * unit).toFixed(1)}"/>
    <rect ${box(0)} fill="${theme.surfaceRaised}" stroke="${theme.tones.success}" stroke-width="${(1.9 * unit).toFixed(1)}" opacity="${landed.toFixed(3)}"/>
    <rect ${box((3 + 8 * ring) * unit)} fill="none" stroke="${theme.tones.success}" stroke-width="${(1.5 * unit).toFixed(1)}" opacity="${(0.55 * ring).toFixed(3)}"/>
    <text x="${(slot.x + slot.w / 2).toFixed(1)}" y="${(slot.y + slot.h / 2).toFixed(1)}" class="hp-code" text-anchor="middle" dominant-baseline="central" opacity="${landed.toFixed(3)}">${config.exitCode}</text>
    ${signal}${code}`
}
