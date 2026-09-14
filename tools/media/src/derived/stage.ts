import type { DerivedConfig } from '../models/derived'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { apiChipStyles } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { derivedLayout, derivedMetrics } from './layout'
import { renderFires, renderLamps, renderNames, renderRail, renderToken, renderWires } from './render'
import { derivedTimeline } from './timeline'

/**
 * Build the stylesheet for the store, with the theme resolved into it.
 *
 * Nothing in HTML carries an `opacity` or a `transform`: either one makes the
 * browser composite the element through a surface of its own, and a headless
 * screenshot can catch that surface with another element's pixels still in
 * it. Chips dim by mixing their colours toward transparent instead, driven by
 * the `--dv-on` property each slot sets.
 *
 * @param config - The store as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function derivedStyles(config: DerivedConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = derivedMetrics(profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.dv-frame { position: absolute; inset: 0; }
.dv-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.dv-mono { font-family: ${theme.fonts.mono}; }
.dv-rail-label { position: absolute; font-family: ${theme.fonts.mono}; font-size: ${metrics.labelPx}px; line-height: 1; color: ${theme.text.faint}; white-space: nowrap; }
.dv-chip-slot { position: absolute; display: inline-flex; }
.dv-chip-slot .api-chip {
  color: color-mix(in srgb, ${theme.tones.accent} var(--dv-on), transparent);
  border-color: color-mix(in srgb, ${theme.accentSoft} var(--dv-on), transparent);
  background: color-mix(in srgb, ${theme.accentSoft} var(--dv-on), transparent);
}
.dv-chip-slot .api-chip__mark { color: color-mix(in srgb, ${theme.accent} var(--dv-on), transparent); }
.dv-head { position: absolute; display: inline-flex; }
.dv-lamp-label { font-size: ${metrics.labelPx}px; }
.dv-name {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: ${round(metrics.namePx * 0.5)}px;
  height: ${metrics.bandHPx}px;
  padding: 0 ${metrics.bandPadPx}px;
  font-family: ${theme.fonts.mono};
  font-size: ${metrics.namePx}px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
.dv-name__band { position: absolute; inset: 0; border-radius: 999px; border: 1px solid transparent; }
.dv-name__dot { position: relative; width: ${metrics.dotRPx * 2}px; height: ${metrics.dotRPx * 2}px; border-radius: 50%; flex: none; }
.dv-name__text { position: relative; }
`
}

/**
 * Four lamps, the names wired to them, and actions that flip the lamps.
 *
 * The store's base flags are lamps in a column on the left; the selectors
 * are names in a column on the right; a faint wire runs from each lamp to
 * every name that reads its flag. Each action on the rail fires in turn and
 * drops a token onto the lamp it lights. The lamps it writes flip, the wires
 * from the lit lamps draw out in the lamps' tones to the names whose
 * conditions now hold, and those names light. Nothing else is said: a reader
 * watches the same action land on a different name the second and third time
 * because a lamp it does not touch was already on.
 */
export const derivedStage: Stage<DerivedConfig> = defineStage<DerivedConfig>({
  id: 'derived',

  styles: derivedStyles,

  durationMs(config: DerivedConfig): number {
    return derivedTimeline(config).settledAt + (config.restMs ?? 1_500)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = derivedMetrics(profile)
    const frame = { config, layout: derivedLayout(config, metrics), timeline: derivedTimeline(config), metrics, theme, atMs }
    return `<div class="dv-frame">
      <svg class="dv-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderWires(frame)}
        ${renderLamps(frame)}
        ${renderFires(frame)}
        ${renderToken(frame)}
      </svg>
      ${renderRail(frame)}
      ${renderNames(frame)}
    </div>`
  },
})
