import type { CascadeConfig } from '../models/cascade'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { apiChipStyles } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { cascadeLayout, cascadeMetrics } from './layout'
import { renderFlights, renderHeader, renderSpine, renderTiles } from './render'
import { renderChangelog, renderChips, renderVersion } from './rows'
import { cascadeTimeline } from './timeline'

/**
 * Build the stylesheet for the cascade, with the theme resolved into it.
 *
 * @param config - The cascade as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function cascadeStyles(config: CascadeConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = cascadeMetrics(profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.cs-frame { position: absolute; inset: 0; }
.cs-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.cs-mono { font-family: ${theme.fonts.mono}; }
.cs-sans { font-family: ${theme.fonts.sans}; }
.cs-chip { position: absolute; display: inline-flex; }
.cs-chip .api-chip {
  color: color-mix(in srgb, ${theme.tones.accent} var(--cs-on), transparent);
  border-color: color-mix(in srgb, ${theme.accentSoft} var(--cs-on), transparent);
  background: color-mix(in srgb, ${theme.accentSoft} var(--cs-on), transparent);
}
.cs-chip .api-chip__mark { color: color-mix(in srgb, ${theme.accent} var(--cs-on), transparent); }
`
}

/**
 * One commit header, and everything that falls out of it.
 *
 * The header types itself at the top of a spine. Then, step by step, copies
 * of its spans fall down the spine into the things they become: the four
 * fields it parses to; the bump that two of those fields converge on; the
 * arrow that takes the version on disk to the next one, its digits rolling
 * over like a counter; and the line written into the changelog, assembled
 * from the fields as they fall in. Each step is named by nothing but the
 * package export that performs it, sitting in the margin at the row it
 * produces, and the spine lights a row further with every step. Nobody in
 * the frame types a version.
 */
export const cascadeStage: Stage<CascadeConfig> = defineStage<CascadeConfig>({
  id: 'cascade',

  styles: cascadeStyles,

  durationMs(config: CascadeConfig, profile: MediaProfile): number {
    const metrics = cascadeMetrics(profile)
    return cascadeTimeline(config, cascadeLayout(config, metrics), metrics).settledAt + (config.restMs ?? 1_200)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = cascadeMetrics(profile)
    const layout = cascadeLayout(config, metrics)
    const frame = { config, layout, timeline: cascadeTimeline(config, layout, metrics), metrics, theme, atMs }
    return `<div class="cs-frame">
      <svg class="cs-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderSpine(frame)}
        ${renderTiles(frame)}
        ${renderHeader(frame)}
        ${renderVersion(frame)}
        ${renderChangelog(frame)}
        ${renderFlights(frame)}
      </svg>
      ${renderChips(frame)}
    </div>`
  },
})
