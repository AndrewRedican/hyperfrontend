import type { LevelsConfig } from '../models/levels'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { apiChipStyles } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { LEVELS, bodySize, levelIndex, levelsMetrics } from './layout'
import { renderChip, renderChrome, renderLines, renderScale, renderWords } from './render'
import { compileMoves, knobAt, lineOpacityAt, settledAt } from './timeline'

/**
 * Build the stylesheet for one window, with its theme resolved into it.
 *
 * @param config - The scene's configuration.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this window.
 */
function levelsStyles(config: LevelsConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = levelsMetrics(profile)
  const dots = theme.chrome.buttons.map((colour, index) => `.lv-dot--${index} { background: ${colour}; }`).join('\n')
  return `
${apiChipStyles(theme, metrics.chipPx)}
.lv-window {
  position: absolute;
  inset: ${metrics.insetPx}px;
  display: flex;
  flex-direction: column;
  font-family: ${theme.fonts.mono};
  background: ${theme.surface};
  border: 1px solid ${theme.border};
  border-radius: ${metrics.radiusPx}px;
  box-shadow: ${theme.shadow};
  overflow: hidden;
}
.lv-chrome {
  flex: 0 0 ${metrics.chromePx}px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 ${metrics.padPx / 2}px;
  background: ${theme.chrome.bar};
  border-bottom: 1px solid ${theme.rule};
}
.lv-dots { display: flex; gap: 6px; }
.lv-dot { width: 9px; height: 9px; border-radius: 50%; display: block; }
${dots}
.lv-title {
  flex: 1;
  text-align: center;
  color: ${theme.chrome.title};
  font-size: ${metrics.titlePx}px;
  letter-spacing: 0.02em;
  padding-right: 39px;
  white-space: nowrap;
}
.lv-body { position: relative; flex: 1; overflow: hidden; }
.lv-band { position: absolute; left: 0; right: 0; top: 0; height: ${metrics.bandPx}px; background: ${theme.surfaceRaised}; border-bottom: 1px solid ${theme.rule}; }
.lv-svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; }
.lv-word {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: ${metrics.wordPx}px;
  line-height: 1;
  color: ${theme.text.muted};
  white-space: nowrap;
}
.lv-word--on { color: ${theme.text.strong}; font-weight: 600; }
.lv-chip { position: absolute; right: ${metrics.padPx}px; transform: translateY(-50%); }
.lv-line {
  position: absolute;
  left: ${metrics.padPx}px;
  display: flex;
  align-items: center;
  gap: ${round(metrics.linePx * 0.75)}px;
  font-size: ${metrics.linePx}px;
  line-height: 1;
  white-space: nowrap;
}
.lv-pip { width: ${metrics.pipPx}px; height: ${metrics.pipPx}px; border-radius: 50%; flex: none; display: block; margin-right: ${round(metrics.linePx * 0.25)}px; }
.lv-prefix { color: ${theme.text.muted}; }
`
}

/**
 * A terminal whose output is decided by a knob.
 *
 * The window holds a level scale across the top and, beneath it, the same five
 * lines in the same order, one per level. The knob slides between stops; the
 * lines whose level sits at or before the knob are printed at full strength,
 * the rest are ghosted in place. Nothing is typed and nothing scrolls: the
 * program is fixed, the level moves, and the visible output follows it.
 */
export const levelsStage: Stage<LevelsConfig> = defineStage<LevelsConfig>({
  id: 'levels',

  styles: levelsStyles,

  durationMs(config: LevelsConfig): number {
    return settledAt(compileMoves(config)) + config.restMs
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = levelsMetrics(profile)
    const [bodyWidth, bodyHeight] = bodySize(profile, metrics)
    const moves = compileMoves(config)
    const start = levelIndex(config.start)
    const knob = knobAt(moves, start, atMs)
    const opacities = LEVELS.map((_, index) => lineOpacityAt(moves, start, index, atMs))
    return `<div class="lv-window">${renderChrome(config.title)}<div class="lv-body">
      <div class="lv-band"></div>
      <svg class="lv-svg" viewBox="0 0 ${bodyWidth} ${bodyHeight}" aria-hidden="true">${renderScale(metrics, theme, knob, atMs)}</svg>
      ${renderWords(metrics, knob)}
      ${renderChip(config, metrics, knob, atMs)}
      ${renderLines(config, metrics, theme, bodyHeight, opacities)}
    </div></div>`
  },
})
