import type { LoopConfig } from '../models/loop'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { figureMetrics, figureStyles } from '../stage/figure'
import { loopLayout } from './layout'
import { renderChip, renderRails, renderStation, renderToken, renderTrack } from './render'
import { BEATS, loopStateAt } from './timeline'

/**
 * Build the stylesheet for the loop, with its theme resolved into it.
 *
 * The rails are the one thing drawn with square corners and a heavy edge,
 * so that they read as a fixture rather than as a fourth participant: the
 * cards are soft and lit by who is acting, the rails are rigid and lit only
 * by what passes through them.
 *
 * @param config - The loop as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this loop.
 */
function loopStyles(config: LoopConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = figureMetrics(profile)
  return `
${figureStyles(theme, metrics)}
.lp-card { fill: ${theme.surface}; stroke-width: 1.4; }
.lp-rails { fill: ${theme.surfaceRaised}; stroke: ${theme.text.muted}; stroke-width: 2; }
.lp-rail { fill: ${theme.surface}; stroke: ${theme.border}; stroke-width: 1.2; }
.lp-rail--next { fill: ${theme.tones.success}; stroke: ${theme.text.faint}; }
.lp-rail-label { font-family: ${theme.fonts.mono}; font-size: ${metrics.monoPx}px; font-weight: 600; fill: ${theme.text.strong}; }
.lp-rail-label--faint { fill: ${theme.text.faint}; font-weight: 500; }
.lp-rail-label--filled { fill: ${theme.transparent ? theme.plate : '#ffffff'}; }
.lp-track { fill: none; stroke: ${theme.border}; stroke-width: 1.4; stroke-dasharray: 4 4; stroke-linecap: round; }
.lp-track--back { stroke: ${theme.tones.success}; opacity: 0.6; }
`
}

/**
 * The loop a change goes round: defined by a person, proposed by a model,
 * checked by rails that neither of them can argue with, reviewed by a
 * person, and then turned into another rail.
 *
 * The model's output is several candidates rather than one, and the rails
 * are where all but one of them stop; that is the thesis, and it is drawn
 * rather than captioned. The survivor comes back round as an accepted
 * change while a new rail travels the return path and fills the dashed slot
 * at the bottom of the rails, so the next change meets one check more.
 */
export const loopStage: Stage<LoopConfig> = defineStage<LoopConfig>({
  id: 'loop',

  styles: loopStyles,

  durationMs(): number {
    return BEATS.end
  },

  frame({ config, profile, theme, atMs }): string {
    const layout = loopLayout(profile, config.rails.length + 1)
    const state = loopStateAt(layout, atMs)
    return `<div class="fig-frame">
      <svg class="fig-svg" viewBox="0 0 ${profile.width} ${profile.height}" width="${profile.width}" height="${profile.height}" aria-hidden="true">
        <text class="fig-caps" x="${profile.width / 2}" y="${layout.captionY}" text-anchor="middle">${escapeHtml(config.caption)}</text>
        ${renderTrack(config, layout)}
        ${renderStation(layout.define, config.define, state.defineLit, 'person', theme)}
        ${renderStation(layout.propose, config.propose, state.proposeLit, 'spark', theme)}
        ${renderStation(layout.review, config.review, state.reviewLit, 'person', theme)}
        ${renderRails(config, layout, state, theme)}
        ${state.tokens.map((token) => renderToken(token, theme)).join('')}
        ${state.chip === undefined ? '' : renderChip(state.chip, theme)}
      </svg>
    </div>`
  },
})
