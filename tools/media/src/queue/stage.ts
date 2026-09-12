import type { MediaProfile } from '../models/profile'
import type { QueueConfig } from '../models/queue'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { apiChipStyles, renderApiChip } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { fifoSlotX, lifoSlotX, queueMetrics } from './layout'
import { renderBand, renderCup, renderDisc, renderLabel, renderSlots, renderTube } from './render'
import { queueState, resolvedAt } from './timeline'

/** The word drawn beside a disc going in. */
const PUSH = 'push'

/** The word drawn beside a disc coming out. */
const PULL = 'pull'

/**
 * Build the stylesheet for the two lists, with the theme resolved into it.
 *
 * @param config - The lists as the scene configured them.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function queueStyles(config: QueueConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = queueMetrics(profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.qu-frame { position: absolute; inset: 0; }
.qu-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.qu-head { position: absolute; top: ${metrics.chipYPx.toFixed(1)}px; transform: translate(-50%, -50%); }
.qu-face { font-family: ${theme.fonts.mono}; font-size: ${metrics.numberPx}px; font-weight: 700; fill: ${theme.text.strong}; }
.qu-label { font-family: ${theme.fonts.mono}; font-size: ${metrics.labelPx}px; font-weight: 600; fill: ${theme.tones.accent}; }
`
}

/**
 * Two lists loaded with the same three objects, drawn as a tube and a cup.
 *
 * The tube is open at both ends: discs drop in at the top and leave through
 * a gate at the bottom, so the first one in is the first one out. The cup is
 * open only at the top: discs drop in at the top and are lifted back out of
 * it, so the last one in is the first one out. The same three discs go into
 * each at the same moments, the same three pulls happen at the same moments,
 * and the two exit rows that fill are the two factories' answers: `1 2 3`
 * under the tube, `3 2 1` beside the cup.
 */
export const queueStage: Stage<QueueConfig> = defineStage<QueueConfig>({
  id: 'queue',

  styles: queueStyles,

  durationMs(config: QueueConfig): number {
    return resolvedAt(config) + (config.restMs ?? 900)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = queueMetrics(profile)
    const state = queueState(config, metrics, atMs)
    const pulls = config.pullAtMs.length
    const tubeSlots = config.pullAtMs.map((_, index) => fifoSlotX(metrics, index, pulls))
    const cupSlots = config.pullAtMs.map((_, index) => lifoSlotX(metrics, index))
    const labelGap = metrics.discRPx + 8 * metrics.scale
    const pushLabels = [metrics.fifoXPx, metrics.lifoXPx]
      .map((centreX) => renderLabel(PUSH, centreX - metrics.stageDxPx - labelGap, metrics.stageYPx, 'left', state.pushLabel))
      .join('')
    const tubePull = renderLabel(
      PULL,
      metrics.fifoXPx - metrics.halfWidthPx - 8 * metrics.scale,
      metrics.bottomPx + 8 * metrics.scale,
      'left',
      state.tubePullLabel
    )
    const cupPull = renderLabel(PULL, metrics.lifoXPx - labelGap, metrics.apexYPx, 'left', state.cupPullLabel)
    return `<div class="qu-frame">
      <svg class="qu-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderBand(tubeSlots, metrics, theme, state.band)}
        ${renderBand(cupSlots, metrics, theme, state.band)}
        ${renderSlots(tubeSlots, metrics, theme)}
        ${renderSlots(cupSlots, metrics, theme)}
        ${renderTube(metrics, theme, state.gate)}
        ${renderCup(metrics, theme)}
        ${state.fifo.map((pose) => renderDisc(pose, metrics, theme)).join('')}
        ${state.lifo.map((pose) => renderDisc(pose, metrics, theme)).join('')}
        ${pushLabels}${tubePull}${cupPull}
      </svg>
      <div class="qu-head" style="left: ${metrics.fifoXPx.toFixed(1)}px">${renderApiChip(config.fifo.name, config.fifo.mark)}</div>
      <div class="qu-head" style="left: ${metrics.lifoXPx.toFixed(1)}px">${renderApiChip(config.lifo.name, config.lifo.mark)}</div>
    </div>`
  },
})
