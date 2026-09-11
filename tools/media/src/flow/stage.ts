import type { FlowConfig, FlowEndpoint, FlowMessage, FlowTheme } from '../models/flow'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import { floor, max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { STAGE_ELEMENT_ID } from '../stage/document'
import { resolveFlowTheme } from './themes'

/** How long a message spends in flight when the scene names nothing. */
const DEFAULT_FLIGHT_MS = 900

/** How long an endpoint stays lit after sending or receiving. */
const GLOW_MS = 600

/** Width past which the diagram is drawn at its full density. */
const WIDE_ENOUGH = 800

/** Advance width of one character, as a fraction of the font size, for the mono face. */
const MONO_RATIO = 0.62

/** Advance width of one character, as a fraction of the font size, for the sans face. */
const SANS_RATIO = 0.52

/** The face labels and log lines are set in. */
const FONT_STACK = "'Liberation Sans', 'DejaVu Sans', 'Inter', Helvetica, Arial, sans-serif"

/** The face message names are set in, so a wire label reads as an identifier. */
const MONO_STACK = "'Liberation Mono', 'DejaVu Sans Mono', 'JetBrains Mono', Menlo, monospace"

/** Where a message is between its two endpoints, and how visible it is. */
interface PacketPosition {
  /** The message being drawn. */
  message: FlowMessage
  /** Progress from sender to receiver, 0 to 1. */
  progress: number
  /** Whether this is a later pulse of a repeating message rather than the first. */
  repeat: boolean
}

/** A message that has landed, and how many times it has landed. */
interface DeliveredMessage {
  /** The message. */
  message: FlowMessage
  /** How many of its pulses have arrived. */
  count: number
}

/** How the diagram is sized for the surface it is being drawn for. */
interface FlowMetrics {
  /** Margin between the diagram and the edge of the frame. */
  padPx: number
  /** Width of an endpoint panel. */
  panelPx: number
  /** Where the panels start, below the phase caption. */
  panelTopPx: number
  /** Vertical position of the wire. */
  wirePx: number
  /** Where the log starts. */
  logPx: number
  /** Font size of an endpoint's name. */
  titlePx: number
  /** Font size of a wire label and a log line. */
  bodyPx: number
  /** Height of one log line. */
  linePx: number
  /** How many log lines fit before the frame runs out. */
  logRows: number
  /** Diameter of a packet. */
  dotPx: number
  /** How much of the frame the wire spans, in pixels. */
  wireSpanPx: number
}

/**
 * Size the diagram for the surface it is being drawn for.
 *
 * The log is the part that has to be measured rather than chosen: it grows for
 * the whole of the exchange, and a diagram whose log runs off the bottom of the
 * frame is a diagram that stopped explaining itself half way through. What fits
 * is computed here and the renderer keeps the newest lines that do.
 *
 * @param profile - The presentation target being composed for.
 * @param hasPhases - Whether a phase caption occupies the top of the frame.
 * @returns Every measurement the renderer needs.
 */
function flowMetrics(profile: MediaProfile, hasPhases: boolean): FlowMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  const padPx = wide ? 34 : 20
  const phasePx = hasPhases ? (wide ? 30 : 24) : 0
  const panelTopPx = phasePx + (wide ? 8 : 4)
  const wirePx = panelTopPx + (wide ? 56 : 40)
  const logPx = panelTopPx + (wide ? 112 : 78)
  const linePx = wide ? 23 : 18
  const room = profile.height - padPx * 2 - logPx
  return {
    padPx,
    panelPx: wide ? 210 : 150,
    panelTopPx,
    wirePx,
    logPx,
    titlePx: wide ? 18 : 15,
    bodyPx: wide ? 13 : 11,
    linePx,
    logRows: max(1, floor(room / linePx) - 1),
    dotPx: wide ? 10 : 8,
    wireSpanPx: max(1, profile.width - padPx * 2 - (wide ? 210 : 150) * 2),
  }
}

/**
 * Ease a linear progress into something with weight.
 *
 * A packet that crosses at a constant rate reads as a marquee. Starting slowly,
 * covering the middle quickly and arriving slowly is what makes it read as a
 * thing that was thrown.
 *
 * @param t - Linear progress from 0 to 1.
 * @returns Eased progress from 0 to 1.
 */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/**
 * Order a scene's messages by the moment they are first sent.
 *
 * @param config - The diagram as the scene configured it.
 * @returns The messages, earliest first.
 */
function ordered(config: FlowConfig): readonly FlowMessage[] {
  return [...config.messages].sort((left, right) => left.atMs - right.atMs)
}

/**
 * Every moment a message leaves its sender.
 *
 * One departure for an ordinary message, and a departure per interval for one
 * that repeats. The list is bounded by the message's own end time rather than
 * by the scene's, so a heartbeat that stops when the session closes stops here
 * too.
 *
 * @param message - The message whose departures are wanted.
 * @returns The offsets at which it is sent.
 */
function departures(message: FlowMessage): readonly number[] {
  const every = message.repeatEveryMs
  if (every === undefined || every <= 0) {
    return [message.atMs]
  }
  const until = message.repeatUntilMs ?? message.atMs
  const sent: number[] = []
  for (let at = message.atMs; at <= until; at += every) {
    sent.push(at)
  }
  return sent
}

/**
 * When the last message lands, which is the length of the exchange itself.
 *
 * @param config - The diagram as the scene configured it.
 * @returns The offset at which nothing is left in flight.
 */
function settledAt(config: FlowConfig): number {
  let latest = 0
  for (const message of config.messages) {
    const flight = message.flightMs ?? DEFAULT_FLIGHT_MS
    for (const at of departures(message)) {
      latest = max(latest, at + flight)
    }
  }
  return latest
}

/**
 * Draw one endpoint.
 *
 * @param endpoint - The participant.
 * @param theme - The colours in use.
 * @param lit - Whether it is sending or has just received.
 * @param side - Which half of the frame it occupies.
 * @returns Markup for the panel.
 */
function renderPanel(endpoint: FlowEndpoint, theme: FlowTheme, lit: boolean, side: string): string {
  const border = lit ? theme.panelActive : theme.panelBorder
  const subtitle = endpoint.subtitle === undefined ? '' : `<div class="f-sub">${escapeHtml(endpoint.subtitle)}</div>`
  const note = endpoint.note === undefined ? '' : `<div class="f-note">${escapeHtml(endpoint.note)}</div>`
  return `<div class="f-panel f-panel--${side}" style="border-color:${border}">
    <div class="f-title">${escapeHtml(endpoint.title)}</div>
    ${subtitle}
    ${note}
  </div>`
}

/**
 * Place every message that is in the air at one instant.
 *
 * @param config - The diagram as the scene configured it.
 * @param atMs - Offset from the start of the timeline.
 * @returns The messages in flight, with how far along they are.
 */
function packetsAt(config: FlowConfig, atMs: number): readonly PacketPosition[] {
  const flying: PacketPosition[] = []
  for (const message of ordered(config)) {
    const flight = message.flightMs ?? DEFAULT_FLIGHT_MS
    let first = true
    for (const at of departures(message)) {
      const elapsed = atMs - at
      if (elapsed >= 0 && elapsed <= flight) {
        flying.push({ message, progress: ease(min(1, elapsed / flight)), repeat: !first })
      }
      first = false
    }
  }
  return flying
}

/**
 * Every message that has landed at least once, with how often.
 *
 * @param config - The diagram as the scene configured it.
 * @param atMs - Offset from the start of the timeline.
 * @returns The delivered messages, earliest first.
 */
function deliveredAt(config: FlowConfig, atMs: number): readonly DeliveredMessage[] {
  const landed: DeliveredMessage[] = []
  for (const message of ordered(config)) {
    const flight = message.flightMs ?? DEFAULT_FLIGHT_MS
    const count = departures(message).filter((at) => atMs >= at + flight).length
    if (count > 0) {
      landed.push({ message, count })
    }
  }
  return landed
}

/**
 * Which named stretch of the exchange is running.
 *
 * @param config - The diagram as the scene configured it.
 * @param atMs - Offset from the start of the timeline.
 * @returns The phase label, or an empty string before the first one begins.
 */
function phaseAt(config: FlowConfig, atMs: number): string {
  let current = ''
  for (const phase of [...(config.phases ?? [])].sort((left, right) => left.atMs - right.atMs)) {
    if (atMs >= phase.atMs) {
      current = phase.label
    }
  }
  return current
}

/**
 * Build the stylesheet for one diagram, with its theme resolved into it.
 *
 * @param config - The diagram as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @returns CSS for this diagram.
 */
function flowStyles(config: FlowConfig, profile: MediaProfile): string {
  const theme = resolveFlowTheme(config.theme)
  const metrics = flowMetrics(profile, (config.phases ?? []).length > 0)
  const wide = profile.width >= WIDE_ENOUGH
  const tones = (['plain', 'muted', 'accent', 'success', 'warning'] as const)
    .map((tone) => `.f-tone--${tone} { color: ${theme.tones[tone]}; }`)
    .join('\n')
  return `
#${STAGE_ELEMENT_ID} { background: ${theme.backdrop}; font-family: ${FONT_STACK}; color: ${theme.title}; }
.f-stage { position: absolute; inset: ${metrics.padPx}px; }
.f-phase {
  position: absolute;
  left: 0;
  top: 0;
  font-size: ${metrics.bodyPx + 1}px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${theme.phase};
}
.f-panel {
  position: absolute;
  top: ${metrics.panelTopPx}px;
  width: ${metrics.panelPx}px;
  padding: ${wide ? 14 : 11}px ${wide ? 16 : 12}px;
  border: 1px solid ${theme.panelBorder};
  border-radius: ${wide ? 12 : 9}px;
  background: ${theme.panel};
  transition: none;
}
.f-panel--left { left: 0; }
.f-panel--right { right: 0; text-align: right; }
.f-title { font-size: ${metrics.titlePx}px; font-weight: 600; letter-spacing: -0.01em; }
.f-sub { margin-top: 3px; font-size: ${metrics.titlePx - 5}px; color: ${theme.subtitle}; font-family: ${MONO_STACK}; }
.f-note { margin-top: 2px; font-size: ${metrics.titlePx - 6}px; color: ${theme.tones.muted}; }
.f-wire {
  position: absolute;
  left: ${metrics.panelPx}px;
  right: ${metrics.panelPx}px;
  top: ${metrics.wirePx}px;
  height: 1px;
  background: ${theme.wire};
}
.f-packet {
  position: absolute;
  left: ${metrics.panelPx}px;
  right: ${metrics.panelPx}px;
  top: ${metrics.wirePx}px;
  height: 0;
}
.f-dot {
  position: absolute;
  top: ${-metrics.dotPx / 2}px;
  width: ${metrics.dotPx}px;
  height: ${metrics.dotPx}px;
  margin-left: ${-metrics.dotPx / 2}px;
  border-radius: 50%;
  background: ${theme.packet};
  box-shadow: 0 0 ${wide ? 14 : 10}px ${theme.packet};
}
/* why: a repeating pulse is the same fact arriving again, so it is drawn as a smaller, quieter mark than the events either side of it */
.f-dot--repeat {
  width: ${metrics.dotPx - 3}px;
  height: ${metrics.dotPx - 3}px;
  top: ${-(metrics.dotPx - 3) / 2}px;
  margin-left: ${-(metrics.dotPx - 3) / 2}px;
  opacity: 0.7;
  box-shadow: none;
}
.f-label {
  position: absolute;
  top: ${wide ? -40 : -32}px;
  transform: translateX(-50%);
  white-space: nowrap;
  text-align: center;
  font-family: ${MONO_STACK};
  font-size: ${metrics.bodyPx}px;
  color: ${theme.tones.accent};
}
.f-detail { margin-top: 1px; font-size: ${metrics.bodyPx - 2}px; color: ${theme.subtitle}; font-family: ${FONT_STACK}; }
/* why: an exchange of six messages in a frame sized for eleven leaves the log
   hugging the wire with a third of the frame empty under it, so the block is
   centred in the room it has and the composition holds whatever length the
   scene turns out to be */
.f-log {
  position: absolute;
  left: 0;
  right: 0;
  top: ${metrics.logPx}px;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-family: ${MONO_STACK};
  font-size: ${metrics.bodyPx}px;
  line-height: ${metrics.linePx}px;
}
.f-line { display: flex; gap: ${wide ? 10 : 7}px; align-items: baseline; }
.f-arrow { color: ${theme.subtitle}; width: ${wide ? 22 : 17}px; flex: none; text-align: center; }
.f-carries { color: ${theme.subtitle}; font-family: ${FONT_STACK}; font-size: ${metrics.bodyPx - 1}px; }
.f-count { color: ${theme.tones.muted}; }
.f-settled { margin-top: ${wide ? 12 : 8}px; font-family: ${FONT_STACK}; color: ${theme.tones.success}; }
${tones}
`
}

/**
 * A message exchange between two endpoints, played out.
 *
 * Two participants and a wire, and everything a protocol scene needs on top of
 * those: what each message carries, which named stretch of the exchange it
 * belongs to, and whether it is an event or a cadence. A heartbeat is the
 * reason the last of those exists: eight beats are one fact about a session,
 * and a log that lists them eight times has buried the six messages that
 * mattered under the one that did not.
 *
 * Every position is derived from the instant the stage was asked for rather
 * than from anything kept between frames, and the log keeps only the newest
 * lines that fit, so a long exchange cannot run off the bottom of the frame.
 */
export const flowStage: Stage<FlowConfig> = defineStage<FlowConfig>({
  id: 'flow',

  styles: flowStyles,

  durationMs(config: FlowConfig): number {
    return settledAt(config) + (config.restMs ?? 1200)
  },

  frame({ config, profile, atMs }): string {
    const theme = resolveFlowTheme(config.theme)
    const metrics = flowMetrics(profile, (config.phases ?? []).length > 0)
    const messages = ordered(config)
    const flying = packetsAt(config, atMs)
    const delivered = deliveredAt(config, atMs)

    const lit = { left: false, right: false }
    for (const message of messages) {
      const flight = message.flightMs ?? DEFAULT_FLIGHT_MS
      const other = message.from === 'left' ? 'right' : 'left'
      for (const at of departures(message)) {
        if (atMs >= at && atMs <= at + flight) {
          lit[message.from] = true
        }
        if (atMs >= at + flight && atMs <= at + flight + GLOW_MS) {
          lit[other] = true
        }
      }
    }

    const packets = flying
      .map(({ message, progress, repeat }) => {
        const percent = message.from === 'left' ? progress * 100 : (1 - progress) * 100
        // why: the dot may sit against either endpoint, but a centred label there would hang over the panel, so the label is kept inside the wire by its own estimated half-width rather than by a fixed limit that a long protocol name would overrun anyway
        const widthPx = max(
          message.label.length * metrics.bodyPx * MONO_RATIO,
          (message.detail ?? '').length * (metrics.bodyPx - 2) * SANS_RATIO
        )
        const halfPercent = min(50, (widthPx / 2 / metrics.wireSpanPx) * 100)
        const labelAt = min(100 - halfPercent, max(halfPercent, percent))
        const dot = `<div class="f-dot${repeat ? ' f-dot--repeat' : ''}" style="left:${percent.toFixed(2)}%"></div>`
        // why: a repeated pulse re-states a name the reader has already read, so only the first one is labelled
        const detail = message.detail === undefined ? '' : `<div class="f-detail">${escapeHtml(message.detail)}</div>`
        const label = repeat ? '' : `<div class="f-label" style="left:${labelAt.toFixed(2)}%">${escapeHtml(message.label)}${detail}</div>`
        return `<div class="f-packet">${dot}${label}</div>`
      })
      .join('')

    // why: the newest lines are the ones the reader is following, so an exchange longer than the frame loses its oldest rather than its latest
    const log = delivered
      .slice(-metrics.logRows)
      .map(({ message, count }) => {
        const carries = message.detail === undefined ? '' : `<span class="f-carries">${escapeHtml(message.detail)}</span>`
        const repeated = count > 1 ? `<span class="f-count">&times;${count}</span>` : ''
        return `<div class="f-line"><span class="f-arrow">${message.from === 'left' ? '&rarr;' : '&larr;'}</span><span class="f-tone--${message.tone ?? 'plain'}">${escapeHtml(message.label)}</span>${repeated}${carries}</div>`
      })
      .join('')

    const settled =
      config.settled !== undefined && delivered.length === messages.length && messages.length > 0 && atMs >= settledAt(config)
        ? `<div class="f-settled">${escapeHtml(config.settled)}</div>`
        : ''

    const phase = phaseAt(config, atMs)
    const caption = phase === '' ? '' : `<div class="f-phase">${escapeHtml(phase)}</div>`

    return `<div class="f-stage">
      ${caption}
      ${renderPanel(config.left, theme, lit.left, 'left')}
      ${renderPanel(config.right, theme, lit.right, 'right')}
      <div class="f-wire"></div>
      ${packets}
      <div class="f-log">${log}${settled}</div>
    </div>`
  },
})
