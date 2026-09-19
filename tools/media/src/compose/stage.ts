import type { ComposeConfig } from '../models/compose'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { defineStage } from '../stage/define-stage'
import { composeLayout } from './layout'
import { renderFeatureWindow, renderHost, renderOverlay } from './render'
import { composeStateAt, settledAt } from './timeline'

/**
 * Build the stylesheet for the composition, with its theme resolved into it.
 *
 * @param config - The composition as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this composition.
 */
function composeStyles(config: ComposeConfig, profile: MediaProfile, theme: MediaTheme): string {
  const layout = composeLayout(profile, config.features.length)
  return `
.cp-frame { position: absolute; inset: 0; }
.cp-svg { position: absolute; left: 0; top: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; pointer-events: none; }
.cp-win { position: absolute; background: ${theme.surface}; border: 1.5px solid ${theme.border}; border-radius: 8px; box-shadow: ${theme.shadow}; overflow: hidden; }
.cp-chrome { display: flex; align-items: center; gap: 5px; height: ${layout.hostChromePx}px; padding: 0 10px; background: ${theme.chrome.bar}; border-bottom: 1px solid ${theme.rule}; }
.cp-chrome--sm { height: ${layout.featureChromePx}px; padding: 0 7px; gap: 4px; }
.cp-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.cp-chrome--sm .cp-dot { width: 5px; height: 5px; }
.cp-dot--0 { background: ${theme.chrome.buttons[0]}; }
.cp-dot--1 { background: ${theme.chrome.buttons[1]}; }
.cp-dot--2 { background: ${theme.chrome.buttons[2]}; }
.cp-pill { margin-left: 6px; padding: 2px 8px; border-radius: 999px; background: ${theme.surface}; border: 1px solid ${theme.rule}; font-family: ${theme.fonts.mono}; font-size: ${layout.textPx}px; line-height: 1.2; color: ${theme.text.muted}; white-space: nowrap; }
.cp-chrome--sm .cp-pill { margin-left: 3px; padding: 1px 6px; font-size: ${layout.textPx - 1.5}px; }
.cp-bar { position: absolute; border-radius: 3px; background: ${theme.rule}; }
.cp-feature .cp-bar { background: ${theme.border}; }
.cp-tag { position: absolute; left: 8px; top: ${layout.featureChromePx + 8}px; padding: 3px 9px; border-radius: 999px; border: 1px solid ${theme.border}; background: ${theme.surfaceRaised}; font-family: ${theme.fonts.mono}; font-size: ${layout.tagPx}px; line-height: 1; font-weight: 600; color: ${theme.text.strong}; white-space: nowrap; }
.cp-ghost { position: absolute; border: 1.5px dashed ${theme.border}; border-radius: 8px; padding: 5px 7px; }
.cp-pill--ghost { margin-left: 0; color: ${theme.text.faint}; border-color: ${theme.rule}; background: transparent; }
.cp-slot { position: absolute; border: 1.5px dashed ${theme.borderActive}; border-radius: 10px; }
.cp-slot--solid { border-style: solid; }
.cp-text { font-family: ${theme.fonts.mono}; font-size: ${layout.textPx}px; font-weight: 600; fill: ${theme.tones.accent}; }
`
}

/**
 * Applications built on different stacks, each at its own origin, seating
 * into one host page at run time.
 *
 * The host is a browser-ish surface with a rail and a stack of empty slots.
 * Three smaller windows, each with its own address and a tag saying what it
 * is built with, slide in one after another and seat into the slots; as each
 * seats, a wire draws itself from the hub in the host's rail to the seated
 * window, and once the wires are live, named messages cross them in both
 * directions. Nothing is rebuilt and nothing shares a runtime: the windows
 * keep their own chrome and their own origin inside the host.
 */
export const composeStage: Stage<ComposeConfig> = defineStage<ComposeConfig>({
  id: 'compose',

  styles: composeStyles,

  durationMs(config: ComposeConfig): number {
    return settledAt(config) + (config.restMs ?? 1000)
  },

  frame({ config, profile, theme, atMs }): string {
    const layout = composeLayout(profile, config.features.length)
    const state = composeStateAt(config, atMs)
    const features = config.features.map((feature, index) => renderFeatureWindow(layout, index, feature, state, theme)).join('')
    return `<div class="cp-frame">
      ${renderHost(layout, config, state)}
      ${features}
      <svg class="cp-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderOverlay(layout, config, state, theme)}
      </svg>
    </div>`
  },
})
