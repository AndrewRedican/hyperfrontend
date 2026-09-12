import type { PortsConfig } from '../models/ports'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { NodePlace, PortsMetrics } from './layout'
import { escapeHtml } from '../lib/escape-html'
import { apiChipStyles, renderApiChip } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { portsLayout, portsMetrics } from './layout'
import { renderNodeCard, renderPulses, renderWire } from './render'
import { portsTimeline } from './timeline'
import { renderMarks, renderSlots, renderTokens } from './tokens'

/**
 * Build the stylesheet for one pair of brokers, with its theme resolved into it.
 *
 * @param config - The brokers as the scene configured them.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function portsStyles(config: PortsConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = portsMetrics(profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.pt-frame { position: absolute; inset: 0; }
.pt-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.pt-node { position: absolute; }
.pt-name { position: absolute; left: 0; right: 0; top: ${metrics.nameTopPx}px; text-align: center; font-family: ${theme.fonts.sans}; font-size: ${metrics.namePx}px; font-weight: 600; line-height: 1.2; color: ${theme.text.strong}; }
.pt-chip { position: absolute; left: 0; right: 0; top: ${metrics.chipTopPx}px; display: flex; justify-content: center; }
.pt-slot-name { font-family: ${theme.fonts.mono}; font-size: ${metrics.labelPx}px; }
.pt-token-name { font-family: ${theme.fonts.mono}; font-size: ${metrics.labelPx}px; font-weight: 600; }
`
}

/**
 * The text on one node's card: its name and the package call it stands for.
 *
 * @param place - The broker's card and everything placed on it.
 * @param config - The brokers as the scene configured them.
 * @returns HTML positioned over the card.
 */
function renderNodeText(place: NodePlace, config: PortsConfig): string {
  const { box } = place
  return `<div class="pt-node" style="left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px">
    <div class="pt-name">${escapeHtml(place.node.label)}</div>
    <div class="pt-chip">${renderApiChip(place.node.api, config.mark)}</div>
  </div>`
}

/**
 * Two brokers with shaped ports, and the messages that fit them or do not.
 *
 * Each broker is a card with a slot cut into the edge that faces the other,
 * one per type its own contract accepts, each a distinct shape. A dashed wire
 * runs between them. Three plain pulses cross it in turn and on the third
 * the wire lights solid and both cards flash: the channel is open. Then the
 * messages, each a token cast in its type's shape with its name under it. A
 * token that reaches a slot of its shape slides in and the card glows; a
 * token whose shape has no slot stops at the boundary, falls, fades, and
 * leaves a small struck circle where it went. Nothing is written about any
 * of it.
 */
export const portsStage: Stage<PortsConfig> = defineStage<PortsConfig>({
  id: 'ports',

  styles: portsStyles,

  durationMs(config: PortsConfig): number {
    return portsTimeline(config).settledAt + (config.restMs ?? 1_100)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics: PortsMetrics = portsMetrics(profile)
    const layout = portsLayout(config, metrics, profile)
    const timeline = portsTimeline(config)
    return `<div class="pt-frame">
      <svg class="pt-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderWire(layout, timeline, theme, atMs)}
        ${renderPulses(layout, timeline, metrics, theme, atMs)}
        ${renderNodeCard(layout.left, timeline, metrics, theme, atMs)}
        ${renderNodeCard(layout.right, timeline, metrics, theme, atMs)}
        ${renderSlots(config, layout.left, timeline, metrics, theme, atMs)}
        ${renderSlots(config, layout.right, timeline, metrics, theme, atMs)}
        ${renderMarks(layout, timeline, metrics, theme, atMs)}
        ${renderTokens(config, layout, timeline, metrics, theme, atMs)}
      </svg>
      ${renderNodeText(layout.left, config)}
      ${renderNodeText(layout.right, config)}
    </div>`
  },
})
