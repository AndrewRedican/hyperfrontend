import type { LanesConfig } from '../models/lanes'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeInOut, progress } from '../lib/motion'
import { apiChipStyles, renderApiChip, renderForeignLabel } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { renderLane } from './lane'
import { lanesLayout, lanesMetrics } from './layout'
import { renderToggle } from './render'
import { GATE_MS, lanesTimeline } from './timeline'

/**
 * How far off the switch is at one instant, which is also how far shut the gate is.
 *
 * @param config - The lanes as the scene configured them.
 * @param atMs - Offset from the start of the timeline.
 * @returns From 0 (on, gate open) to 1 (off, gate across the lane).
 */
function offAt(config: LanesConfig, atMs: number): number {
  const going = easeInOut(progress(atMs, config.offAtMs, GATE_MS))
  const back = easeInOut(progress(atMs, config.onAtMs, GATE_MS))
  return going * (1 - back)
}

/**
 * Build the stylesheet for the lanes, with the theme resolved into it.
 *
 * @param config - The lanes as the scene configured them.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function lanesStyles(config: LanesConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = lanesMetrics(profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.ln-frame { position: absolute; inset: 0; }
.ln-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.ln-head { position: absolute; top: ${round(metrics.headYPx - metrics.headHPx / 2)}px; height: ${metrics.headHPx}px; display: flex; align-items: center; justify-content: center; }
.ln-chip { white-space: pre-line; line-height: 1.2; text-align: left; }
.ln-mono { font-family: ${theme.fonts.mono}; }
.ln-box { font-size: ${metrics.labelPx}px; font-weight: 600; fill: ${theme.text.plain}; }
.ln-token { font-size: ${metrics.valuePx}px; font-weight: 700; }
.ln-badge { font-size: ${metrics.smallPx}px; font-weight: 700; fill: ${theme.tones.accent}; }
.ln-value { font-size: ${metrics.valuePx}px; font-weight: 700; }
.ln-value--small { font-size: ${metrics.smallPx}px; font-weight: 500; }
.ln-small { font-size: ${metrics.smallPx}px; }
`
}

/**
 * The same three calls dropped into four lanes, with a different fate in each.
 *
 * Every lane has the same function in a box half way down, and a token for
 * each call falls onto it at the same moment in every lane. The plain lane is
 * the control: the first token goes through and lands in the tray, the
 * second reaches the box while the switch in the margin is off, the box
 * bursts, a bar seals the lane, and the third token stops at the bar. The
 * other three lanes wrap the box: a ring that becomes a cache after the first
 * result and sends later tokens round the box with the stored value; a gate
 * that reads the switch and turns a token back while it is off; a shield that
 * lets every token through and holds the burst in. What each lane's tray
 * collects is what the wrapped call returned.
 */
export const lanesStage: Stage<LanesConfig> = defineStage<LanesConfig>({
  id: 'lanes',

  styles: lanesStyles,

  durationMs(config: LanesConfig, profile: MediaProfile): number {
    return lanesTimeline(config, lanesMetrics(profile)).settledAt + (config.restMs ?? 1_100)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = lanesMetrics(profile)
    const layout = lanesLayout(config, metrics)
    const timeline = lanesTimeline(config, metrics)
    const shut = offAt(config, atMs)
    const lanes = config.lanes
      .map((lane, index) => {
        const geometry = layout.lanes[index]
        const plan = timeline.lanes[index]
        return geometry === undefined || plan === undefined
          ? ''
          : renderLane({ config, layout, metrics, theme, geometry, plan, shut, atMs })
      })
      .join('')
    const heads = config.lanes
      .map((lane, index) => {
        const geometry = layout.lanes[index]
        if (geometry === undefined) {
          return ''
        }
        const name = lane.kind === 'plain' ? renderForeignLabel(lane.name) : renderApiChip(lane.name, config.mark, 'ln-chip')
        return `<div class="ln-head" style="left:${geometry.left}px;width:${geometry.width}px">${name}</div>`
      })
      .join('')
    return `<div class="ln-frame">
      <svg class="ln-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderToggle(layout.toggleX, shut, config.toggle, metrics, theme)}
        ${lanes}
      </svg>
      ${heads}
    </div>`
  },
})
