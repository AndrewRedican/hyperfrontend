import type { BridgeConfig } from '../models/bridge'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { ceil, max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { apiChipStyles } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { bridgeLayout, bridgeMetrics } from './layout'
import { renderLabels, renderLines, renderReport, renderReportChip, renderSheet, renderSockets, renderVerdict, renderWires } from './render'
import { bridgeTimeline } from './timeline'

/**
 * Build the stylesheet for the bridge, with the theme resolved into it.
 *
 * Nothing in HTML carries an `opacity` or a `transform`: either one makes the
 * browser composite the element through a surface of its own, and a headless
 * screenshot can catch that surface with another element's pixels still in
 * it. Chips and labels light by mixing their colours, driven by the `--br-on`
 * property each slot sets.
 *
 * @param config - The bridge as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function bridgeStyles(config: BridgeConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = bridgeMetrics(profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.br-frame { position: absolute; inset: 0; }
.br-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.br-mono { font-family: ${theme.fonts.mono}; }
.br-sans { font-family: ${theme.fonts.sans}; }
.br-line {
  position: absolute;
  display: flex;
  align-items: center;
  height: ${metrics.lineHPx}px;
  font-family: ${theme.fonts.mono};
  font-size: ${metrics.codePx}px;
  line-height: 1;
  color: ${theme.text.plain};
  white-space: pre;
}
.br-chip { display: inline-flex; }
.br-chip .api-chip {
  color: color-mix(in srgb, ${theme.tones.accent} var(--br-on), transparent);
  border-color: color-mix(in srgb, ${theme.accentSoft} var(--br-on), transparent);
  background: color-mix(in srgb, ${theme.accentSoft} var(--br-on), transparent);
}
.br-chip .api-chip__mark { color: color-mix(in srgb, ${theme.accent} var(--br-on), transparent); }
.br-report { position: absolute; }
.br-code { white-space: pre; }
.br-caret {
  display: inline-block;
  width: ${max(2, ceil(metrics.codePx * 0.09))}px;
  height: ${ceil(metrics.codePx * 1.1)}px;
  margin-left: 1px;
  background: ${theme.accent};
}
.br-label { position: absolute; display: inline-flex; align-items: center; gap: ${round(metrics.labelPx * 0.6)}px; }
.br-label .api-foreign { color: color-mix(in srgb, ${theme.text.strong} var(--br-on), ${theme.text.muted}); font-weight: 500; }
.br-tally {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: ${round(metrics.tallyPx * 1.7)}px;
  height: ${round(metrics.tallyPx * 1.7)}px;
  padding: 0 ${round(metrics.tallyPx * 0.45)}px;
  border-radius: 999px;
  background: color-mix(in srgb, ${theme.accent} var(--br-on), transparent);
  color: color-mix(in srgb, ${theme.surface} var(--br-on), transparent);
  font-family: ${theme.fonts.mono};
  font-size: ${metrics.tallyPx}px;
  line-height: 1;
  font-weight: 700;
}
`
}

/**
 * A spec sheet wired to the platform it runs on.
 *
 * A Jest-style spec types itself onto a sheet on the left, line by line,
 * each line opening with the package export it calls. As each line is typed
 * a wire draws from its end to a socket on the right, where the Node
 * primitive that call rests on stands as a plain label, and the label
 * lights; two calls that rest on the same primitive land on the same socket,
 * and a socket that keeps count shows how many have landed. When the last
 * wire is in, the verdict comes back along the test's wire and a check lands
 * beside the test; then the coverage figure appears along the bottom of the
 * sheet, its numbers count up, and the tick lands beside them. Nothing is
 * said in words: the spec is the Jest side, the labels are the Node side,
 * and the wires are the package.
 */
export const bridgeStage: Stage<BridgeConfig> = defineStage<BridgeConfig>({
  id: 'bridge',

  styles: bridgeStyles,

  durationMs(config: BridgeConfig): number {
    return bridgeTimeline(config).settledAt + (config.restMs ?? 1_200)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = bridgeMetrics(profile)
    const frame = { config, layout: bridgeLayout(config, metrics), timeline: bridgeTimeline(config), metrics, theme, atMs }
    return `<div class="br-frame">
      <svg class="br-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderSheet(frame)}
        ${renderWires(frame)}
        ${renderSockets(frame)}
        ${renderVerdict(frame)}
        ${renderReport(frame)}
      </svg>
      ${renderLines(frame)}
      ${renderLabels(frame)}
      ${renderReportChip(frame)}
    </div>`
  },
})
