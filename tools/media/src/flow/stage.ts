import type { FlowConfig, FlowEndpoint, FlowMessage, FlowTheme } from '../models/flow'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
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

/** How far along the wire a label may travel before it would reach a panel. */
const LABEL_LIMIT = 78

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
 * Order a scene's messages by the moment they are sent.
 *
 * @param config - The diagram as the scene configured it.
 * @returns The messages, earliest first.
 */
function ordered(config: FlowConfig): readonly FlowMessage[] {
  return [...config.messages].sort((left, right) => left.atMs - right.atMs)
}

/**
 * When the last message lands, which is the length of the exchange itself.
 *
 * @param config - The diagram as the scene configured it.
 * @returns The offset at which nothing is left in flight.
 */
function settledAt(config: FlowConfig): number {
  return config.messages.reduce((latest, message) => max(latest, message.atMs + (message.flightMs ?? DEFAULT_FLIGHT_MS)), 0)
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
  return `<div class="f-panel f-panel--${side}" style="border-color:${border}">
    <div class="f-title">${escapeHtml(endpoint.title)}</div>
    ${subtitle}
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
    const elapsed = atMs - message.atMs
    if (elapsed >= 0 && elapsed <= flight) {
      flying.push({ message, progress: ease(min(1, elapsed / flight)) })
    }
  }
  return flying
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
  const wide = profile.width >= WIDE_ENOUGH
  const pad = wide ? 34 : 20
  const panelWidth = wide ? 210 : 150
  const title = wide ? 18 : 15
  const tones = (['plain', 'muted', 'accent', 'success'] as const)
    .map((tone) => `.f-tone--${tone} { color: ${theme.tones[tone]}; }`)
    .join('\n')
  return `
#${STAGE_ELEMENT_ID} { background: ${theme.backdrop}; font-family: ${FONT_STACK}; color: ${theme.title}; }
.f-stage { position: absolute; inset: ${pad}px; }
.f-panel {
  position: absolute;
  top: ${wide ? 44 : 26}px;
  width: ${panelWidth}px;
  padding: ${wide ? 16 : 12}px ${wide ? 18 : 13}px;
  border: 1px solid ${theme.panelBorder};
  border-radius: ${wide ? 12 : 9}px;
  background: ${theme.panel};
  transition: none;
}
.f-panel--left { left: 0; }
.f-panel--right { right: 0; text-align: right; }
.f-title { font-size: ${title}px; font-weight: 600; letter-spacing: -0.01em; }
.f-sub { margin-top: 3px; font-size: ${title - 5}px; color: ${theme.subtitle}; font-family: ${MONO_STACK}; }
.f-wire {
  position: absolute;
  left: ${panelWidth}px;
  right: ${panelWidth}px;
  top: ${wide ? 96 : 62}px;
  height: 1px;
  background: ${theme.wire};
}
.f-packet {
  position: absolute;
  left: ${panelWidth}px;
  right: ${panelWidth}px;
  top: ${wide ? 96 : 62}px;
  height: 0;
}
.f-dot {
  position: absolute;
  top: ${wide ? -5 : -4}px;
  width: ${wide ? 10 : 8}px;
  height: ${wide ? 10 : 8}px;
  margin-left: ${wide ? -5 : -4}px;
  border-radius: 50%;
  background: ${theme.packet};
  box-shadow: 0 0 ${wide ? 14 : 10}px ${theme.packet};
}
.f-label {
  position: absolute;
  top: ${wide ? -34 : -27}px;
  transform: translateX(-50%);
  white-space: nowrap;
  font-family: ${MONO_STACK};
  font-size: ${wide ? 13 : 11}px;
  color: ${theme.tones.accent};
}
.f-log {
  position: absolute;
  left: 0;
  right: 0;
  top: ${wide ? 152 : 104}px;
  font-family: ${MONO_STACK};
  font-size: ${wide ? 13 : 11}px;
  line-height: ${wide ? 24 : 19}px;
}
.f-line { display: flex; gap: ${wide ? 10 : 7}px; align-items: baseline; }
.f-arrow { color: ${theme.subtitle}; width: ${wide ? 22 : 17}px; flex: none; text-align: center; }
.f-settled { margin-top: ${wide ? 14 : 10}px; font-family: ${FONT_STACK}; color: ${theme.tones.success}; }
${tones}
`
}

/**
 * A message exchange between two endpoints, played out.
 *
 * The second stage in the workspace, and the reason it exists: nothing in the
 * harness knows what a terminal is, so a stage that draws something else needs
 * no accommodation from it. This one takes a list of messages and a pair of
 * names and animates the conversation, deriving every position from the instant
 * it was asked for rather than from anything it kept between frames.
 */
export const flowStage: Stage<FlowConfig> = defineStage<FlowConfig>({
  id: 'flow',

  styles: flowStyles,

  durationMs(config: FlowConfig): number {
    return settledAt(config) + (config.restMs ?? 1200)
  },

  frame({ config, atMs }): string {
    const theme = resolveFlowTheme(config.theme)
    const messages = ordered(config)
    const flying = packetsAt(config, atMs)
    const delivered = messages.filter((message) => atMs >= message.atMs + (message.flightMs ?? DEFAULT_FLIGHT_MS))

    const lit = { left: false, right: false }
    for (const message of messages) {
      const flight = message.flightMs ?? DEFAULT_FLIGHT_MS
      const other = message.from === 'left' ? 'right' : 'left'
      if (atMs >= message.atMs && atMs <= message.atMs + flight) {
        lit[message.from] = true
      }
      if (atMs >= message.atMs + flight && atMs <= message.atMs + flight + GLOW_MS) {
        lit[other] = true
      }
    }

    const packets = flying
      .map(({ message, progress }) => {
        const percent = message.from === 'left' ? progress * 100 : (1 - progress) * 100
        // why: the dot may sit against either endpoint, but a centred label there would hang over the panel, so the label stops short of both ends while the dot does not
        const labelAt = min(LABEL_LIMIT, max(100 - LABEL_LIMIT, percent))
        return `<div class="f-packet"><div class="f-dot" style="left:${percent.toFixed(2)}%"></div><div class="f-label" style="left:${labelAt.toFixed(2)}%">${escapeHtml(message.label)}</div></div>`
      })
      .join('')

    const log = delivered
      .map(
        (message) =>
          `<div class="f-line"><span class="f-arrow">${message.from === 'left' ? '&rarr;' : '&larr;'}</span><span class="f-tone--${message.tone ?? 'plain'}">${escapeHtml(message.label)}</span></div>`
      )
      .join('')

    const settled =
      config.settled !== undefined && delivered.length === messages.length && messages.length > 0
        ? `<div class="f-settled">${escapeHtml(config.settled)}</div>`
        : ''

    return `<div class="f-stage">
      ${renderPanel(config.left, theme, lit.left, 'left')}
      ${renderPanel(config.right, theme, lit.right, 'right')}
      <div class="f-wire"></div>
      ${packets}
      <div class="f-log">${log}${settled}</div>
    </div>`
  },
})
