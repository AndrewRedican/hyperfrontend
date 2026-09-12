import type { MediaProfile } from '../models/profile'
import type { SealedConfig } from '../models/sealed'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { SealedContext } from './render'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { pulse } from '../lib/motion'
import { apiChipStyles, renderApiChip } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { sealedLayout, sealedMetrics } from './layout'
import {
  ghostCapsule,
  messageCapsule,
  renderCapsule,
  renderCompare,
  renderDefs,
  renderHello,
  renderListener,
  renderNode,
  renderPipe,
  renderTray,
} from './render'
import { KEY_PULSE_MS, sealedTimeline } from './timeline'

/**
 * Build the stylesheet for one exchange, with its theme resolved into it.
 *
 * @param config - The exchange as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function sealedStyles(config: SealedConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = sealedMetrics(profile)
  const layout = sealedLayout(metrics, profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.sl-frame { position: absolute; inset: 0; }
.sl-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.sl-chip { position: absolute; }
.sl-chip--channel { left: ${layout.sender.x}px; top: ${layout.chipTop}px; }
.sl-chip--drop { left: ${layout.dropChipX}px; top: ${layout.dropChipTop}px; transform: translateX(-50%); }
.sl-name { font-family: ${theme.fonts.mono}; font-size: ${metrics.namePx}px; fill: ${theme.text.muted}; }
.sl-hello { font-family: ${theme.fonts.mono}; font-size: ${metrics.monoPx}px; fill: ${theme.text.muted}; }
.sl-digit { font-family: ${theme.fonts.mono}; font-size: ${metrics.digitPx}px; font-weight: 600; }
.sl-compare { font-family: ${theme.fonts.mono}; font-size: ${metrics.comparePx}px; font-weight: 700; fill: ${theme.tones.danger}; }
.sl-code { font-family: ${theme.fonts.mono}; font-size: ${metrics.monoPx}px; font-weight: 600; fill: ${theme.tones.danger}; }
`
}

/**
 * How strongly a node's key is glowing because it is working: the strongest of the pulses its messages start.
 *
 * @param context - The stage at this instant.
 * @param starts - When each message makes this key work: its seal at the sender, its unwrap at the receiver.
 * @returns Intensity from 0 to 1.
 */
function working(context: SealedContext, starts: readonly number[]): number {
  return starts.reduce((strongest, startAt) => max(strongest, pulse(context.atMs, startAt, KEY_PULSE_MS)), 0)
}

/**
 * Two ends, a pipe, and a seal with a number on it.
 *
 * Each end sends the other a hello, a hollow key crossing the pipe in the
 * clear, and as each arrives the receiving end's key turns and glows: both
 * ends now hold the same session key. A message card then appears beside the
 * sender and is wrapped in place: a numbered header strip slides onto its
 * left, its placeholder dots scramble into hatch, a tag cap snaps onto its
 * right. The frame crosses the pipe and is unwrapped at the receiver, whose
 * key glows as it opens it. A second, numbered `2`, follows. While it is mid
 * pipe a listener under the transport lights and a faint copy peels off to
 * sit beside it. The listener pushes the copy back into the pipe; it reaches
 * the receiver's edge and stops, its `2` flashes, a comparison against the
 * last counter accepted appears above it, and it falls into the tray under
 * the receiver with its code written beside it. The receiver's key never
 * glows for it: the number was enough.
 */
export const sealedStage: Stage<SealedConfig> = defineStage<SealedConfig>({
  id: 'sealed',

  styles: sealedStyles,

  durationMs(config: SealedConfig): number {
    return sealedTimeline(config).settledAt + (config.restMs ?? 1_100)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = sealedMetrics(profile)
    const layout = sealedLayout(metrics, profile)
    const timeline = sealedTimeline(config)
    const context: SealedContext = { config, layout, metrics, theme, timeline, atMs }
    const ghost = ghostCapsule(context)
    const messages = timeline.messages.map((schedule, index) => messageCapsule(context, schedule, `${index + 1}`))
    const sender = renderNode(
      context,
      layout.sender,
      config.ends.sender,
      timeline.senderKeyedAt,
      working(
        context,
        timeline.messages.map((schedule) => schedule.sealAt)
      )
    )
    const receiver = renderNode(
      context,
      layout.receiver,
      config.ends.receiver,
      timeline.receiverKeyedAt,
      working(
        context,
        timeline.messages.map((schedule) => schedule.unwrapAt)
      )
    )
    return `<div class="sl-frame">
      <svg class="sl-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderDefs(theme)}
        ${renderPipe(context)}
        ${renderTray(context)}
        ${renderListener(context)}
        ${ghost === undefined ? '' : renderCapsule(ghost, metrics, theme)}
        ${messages.map((capsule) => (capsule === undefined ? '' : renderCapsule(capsule, metrics, theme))).join('')}
        ${sender}
        ${receiver}
        ${renderHello(context, true)}
        ${renderHello(context, false)}
        ${renderCompare(context)}
      </svg>
      <div class="sl-chip sl-chip--channel">${renderApiChip(config.api.channel, config.api.mark)}</div>
      <div class="sl-chip sl-chip--drop">${renderApiChip(config.api.drop, config.api.mark)}</div>
    </div>`
  },
})
