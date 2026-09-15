import type { NegotiationConfig, NegotiationPanel } from '../models/negotiation'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { PanelState } from './timeline'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { figureMetrics, figureStyles, renderArrowhead } from '../stage/figure'
import { afterStateAt, beforeStateAt, NEGOTIATION_END_MS } from './timeline'

/** Height of one panel. */
const PANEL_H = 176

/** Width of a peer's card. */
const CARD_W = 116

/** Height of a peer's card. */
const CARD_H = 52

/** Where one panel's parts sit. */
interface PanelLayout {
  /** Top of the panel. */
  top: number
  /** Left edge of the panel. */
  left: number
  /** Width of the panel. */
  width: number
  /** Vertical position of the wire and the cards. */
  wireY: number
  /** Left edge of the host's card. */
  hostX: number
  /** Left edge of the hostee's card. */
  hosteeX: number
  /** Where the wire starts. */
  wireFrom: number
  /** Where the wire ends. */
  wireTo: number
}

/**
 * Lay one panel out.
 *
 * @param profile - The presentation target being composed for.
 * @param top - Where the panel's top edge sits.
 * @returns Every position the panel's renderer needs.
 */
function panelLayout(profile: MediaProfile, top: number): PanelLayout {
  const inset = figureMetrics(profile).insetPx
  const left = inset
  const width = profile.width - inset * 2
  return {
    top,
    left,
    width,
    wireY: top + 118,
    hostX: left + 28,
    hosteeX: left + width - 28 - CARD_W,
    wireFrom: left + 28 + CARD_W + 10,
    wireTo: left + width - 28 - CARD_W - 10,
  }
}

/**
 * Draw one peer's card, with its state under it and its delivery flash.
 *
 * @param x - Left edge.
 * @param y - Vertical centre.
 * @param label - The card's label.
 * @param state - The line under it.
 * @param ready - Whether the peer is up.
 * @param flash - How strongly it flashes for a delivery.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the card.
 */
function renderPeer(x: number, y: number, label: string, state: string, ready: boolean, flash: number, theme: MediaTheme): string {
  const ring =
    flash > 0
      ? `<rect x="${x - 5}" y="${y - CARD_H / 2 - 5}" width="${CARD_W + 10}" height="${CARD_H + 10}" rx="14" fill="none" stroke="${theme.tones.success}" stroke-width="2" opacity="${(0.8 * flash).toFixed(3)}"/>`
      : ''
  return `${ring}<rect class="ng-card${ready ? '' : ' ng-card--down'}" x="${x}" y="${y - CARD_H / 2}" width="${CARD_W}" height="${CARD_H}" rx="10"/>
    <text class="fig-label${ready ? '' : ' ng-dim'}" x="${x + CARD_W / 2}" y="${y + 5}" text-anchor="middle">${escapeHtml(label)}</text>
    <text class="fig-mono${ready ? ' fig-mono--strong' : ''}" x="${x + CARD_W / 2}" y="${y + CARD_H / 2 + 18}" text-anchor="middle">${escapeHtml(state)}</text>`
}

/**
 * Draw one panel: its outline, its caption, the two peers, the wire and
 * everything on it.
 *
 * @param panel - What the panel says about itself.
 * @param layout - Where its parts sit.
 * @param state - What the moment shows.
 * @param config - The figure as the scene configured it.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the panel.
 */
function renderPanel(
  panel: NegotiationPanel,
  layout: PanelLayout,
  state: PanelState,
  config: NegotiationConfig,
  theme: MediaTheme
): string {
  const y = layout.wireY
  const span = layout.wireTo - layout.wireFrom
  const hostState = state.waiting ? config.waiting : config.ready
  const hosteeState = state.hosteeReady ? config.ready : config.booting
  const flights = state.flights
    .map((flight) => {
      const x = layout.wireFrom + flight.t * span
      // why: the label stays over the wire even as the dot reaches a card, so a name never sits on top of the card it is arriving at
      const labelX = min(max(x, layout.wireFrom + 34), layout.wireTo - 34)
      return `<g opacity="${flight.opacity.toFixed(3)}"><circle cx="${x.toFixed(1)}" cy="${y}" r="12" fill="${theme.accent}" opacity="0.16"/><circle cx="${x.toFixed(1)}" cy="${y}" r="6" fill="${theme.accent}"/><text class="fig-mono fig-mono--accent" x="${labelX.toFixed(1)}" y="${y - 14}" text-anchor="middle">${escapeHtml(flight.label)}</text></g>`
    })
    .join('')
  const lostX = layout.wireTo - 48
  const lost =
    state.lost <= 0
      ? ''
      : `<g opacity="${state.lost.toFixed(3)}"><circle cx="${lostX}" cy="${y}" r="8" fill="${theme.tones.danger}"/><path d="M ${lostX - 3.5} ${y - 3.5} l 7 7 M ${lostX + 3.5} ${y - 3.5} l -7 7" fill="none" stroke="${theme.transparent ? theme.plate : '#ffffff'}" stroke-width="1.8" stroke-linecap="round"/><text class="fig-mono ng-lost" x="${lostX}" y="${y + 26}" text-anchor="middle">${escapeHtml(config.lost)}</text></g>`
  const middle = (layout.wireFrom + layout.wireTo) / 2
  const session =
    state.session <= 0
      ? ''
      : `<g transform="translate(${middle} ${y}) scale(${state.session.toFixed(3)})"><rect x="-50" y="-12" width="100" height="24" rx="12" fill="${theme.tones.success}"/><g transform="translate(-34 0)" fill="none" stroke="${theme.transparent ? theme.plate : '#ffffff'}" stroke-width="1.6" stroke-linecap="round"><rect x="-4.5" y="-1.5" width="9" height="7.5" rx="1.5"/><path d="M -3 -1.5 v -2.5 a 3 3 0 0 1 6 0 v 2.5"/></g><text class="ng-session" x="8" y="4" text-anchor="middle">${escapeHtml(config.session)}</text></g>`
  return `
    <rect class="ng-panel" x="${layout.left}" y="${layout.top}" width="${layout.width}" height="${PANEL_H}" rx="14"/>
    <text class="fig-caps" x="${layout.left + 18}" y="${layout.top + 26}">${escapeHtml(panel.caption)}</text>
    <text class="fig-note" x="${layout.left + 18}" y="${layout.top + 44}">${escapeHtml(panel.note)}</text>
    <line class="ng-wire${state.live ? ' ng-wire--live' : ''}" x1="${layout.wireFrom}" y1="${y}" x2="${layout.wireTo}" y2="${y}"/>
    <circle cx="${layout.wireFrom + 10}" cy="${y}" r="5" fill="${state.live ? theme.accent : 'none'}" stroke="${state.live ? theme.accent : theme.text.faint}" stroke-width="1.6"/>
    ${renderPeer(layout.hostX, y, config.host, hostState, true, state.hostFlash, theme)}
    ${renderPeer(layout.hosteeX, y, config.hostee, hosteeState, state.hosteeReady, state.hosteeFlash, theme)}
    ${flights}${lost}${session}`
}

/**
 * Draw the evolution strip: the stops, joined by arrows.
 *
 * @param config - The figure as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param top - Vertical position of the strip's caption.
 * @returns SVG markup for the strip.
 */
function renderStrip(config: NegotiationConfig, profile: MediaProfile, top: number): string {
  const metrics = figureMetrics(profile)
  const count = config.stops.length
  const stopW = 200
  const gap = (profile.width - metrics.insetPx * 2 - count * stopW) / (count - 1)
  const y = top + 40
  const stops = config.stops
    .map((stop, index) => {
      const x = metrics.insetPx + index * (stopW + gap)
      const arrow =
        index === 0
          ? ''
          : `<g class="fig-edge"><line x1="${x - gap + 12}" y1="${y}" x2="${x - 12}" y2="${y}"/>${renderArrowhead(x - 12, y, 0, 6)}</g>`
      return `${arrow}<rect class="fig-card" x="${x}" y="${y - 22}" width="${stopW}" height="44" rx="10"/>
        <text class="fig-mono fig-mono--strong" x="${x + stopW / 2}" y="${y - 3}" text-anchor="middle">${escapeHtml(stop.label)}</text>
        <text class="fig-note" x="${x + stopW / 2}" y="${y + 14}" text-anchor="middle">${escapeHtml(stop.note)}</text>`
    })
    .join('')
  return `<text class="fig-caps" x="${metrics.insetPx}" y="${top}">${escapeHtml(config.stripCaption)}</text>${stops}`
}

/**
 * Build the stylesheet for the figure, with its theme resolved into it.
 *
 * @param config - The figure as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this figure.
 */
function negotiationStyles(config: NegotiationConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = figureMetrics(profile)
  return `
${figureStyles(theme, metrics)}
.ng-panel { fill: ${theme.surface}; stroke: ${theme.border}; stroke-width: 1.2; }
.ng-card { fill: ${theme.surfaceRaised}; stroke: ${theme.border}; stroke-width: 1.4; }
.ng-card--down { stroke-dasharray: 4 3; opacity: 0.55; }
.ng-dim { fill: ${theme.text.muted}; }
.ng-wire { stroke: ${theme.text.faint}; stroke-width: 1.6; stroke-dasharray: 5 5; stroke-linecap: round; }
.ng-wire--live { stroke: ${theme.accent}; stroke-width: 2; stroke-dasharray: none; }
.ng-lost { fill: ${theme.tones.danger}; font-weight: 600; }
.ng-session { font-family: ${theme.fonts.mono}; font-size: ${metrics.monoPx}px; font-weight: 700; fill: ${theme.transparent ? theme.plate : '#ffffff'}; }
`
}

/**
 * Two channels side by side in time: one that activates itself, one that
 * waits for a handshake.
 *
 * Both panels share a clock, a host that is up from the start and a hostee
 * that takes a while to start. In the first the wire is live at once, so
 * the first message lands on nothing and is lost; in the second the wire is
 * dormant, the host's greeting goes unanswered until the hostee is up, the
 * two agree a session, and only then does anything flow. The strip under
 * them is the history that pressure produced.
 */
export const negotiationStage: Stage<NegotiationConfig> = defineStage<NegotiationConfig>({
  id: 'negotiation',

  styles: negotiationStyles,

  durationMs(): number {
    return NEGOTIATION_END_MS
  },

  frame({ config, profile, theme, atMs }): string {
    const before = panelLayout(profile, 44)
    const after = panelLayout(profile, 44 + PANEL_H + 18)
    return `<div class="fig-frame">
      <svg class="fig-svg" viewBox="0 0 ${profile.width} ${profile.height}" width="${profile.width}" height="${profile.height}" aria-hidden="true">
        ${renderPanel(config.before, before, beforeStateAt(atMs), config, theme)}
        ${renderPanel(config.after, after, afterStateAt(atMs), config, theme)}
        ${renderStrip(config, profile, after.top + PANEL_H + 40)}
      </svg>
    </div>`
  },
})
