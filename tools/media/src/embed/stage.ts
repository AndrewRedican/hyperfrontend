import type { EmbedConfig } from '../models/embed'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { apiChipStyles } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { embedLayout } from './layout'
import { renderDraft, renderFlights, renderGate, renderPort, renderRing, renderSocket, renderWire } from './render-wire'
import { renderBracket, renderFeature, renderFlash, renderHost, renderReceipt, renderShellChip, renderSlot } from './render-world'
import { embedStateAt, settledAt } from './timeline'

/**
 * Build the stylesheet for the world, with its theme resolved into it.
 *
 * @param config - The world as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this world.
 */
function embedStyles(config: EmbedConfig, profile: MediaProfile, theme: MediaTheme): string {
  const layout = embedLayout(profile, !config.script.some((event) => event.kind === 'dock'))
  return `
${apiChipStyles(theme, layout.textPx)}
.em-frame { position: absolute; inset: 0; }
.em-svg { position: absolute; left: 0; top: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; pointer-events: none; }
.em-win { position: absolute; background: ${theme.surface}; border: 1.5px solid ${theme.border}; border-radius: 8px; box-shadow: ${theme.shadow}; overflow: hidden; }
.em-chrome { display: flex; align-items: center; gap: 5px; height: ${layout.hostChromePx}px; padding: 0 10px; background: ${theme.chrome.bar}; border-bottom: 1px solid ${theme.rule}; }
.em-chrome--sm { height: ${layout.featureChromePx}px; padding: 0 7px; gap: 4px; }
.em-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.em-chrome--sm .em-dot { width: 5px; height: 5px; }
.em-dot--0 { background: ${theme.chrome.buttons[0]}; }
.em-dot--1 { background: ${theme.chrome.buttons[1]}; }
.em-dot--2 { background: ${theme.chrome.buttons[2]}; }
.em-bar { position: absolute; border-radius: 3px; background: ${theme.rule}; }
.em-feature .em-bar { background: ${theme.border}; }
.em-close { margin-left: auto; display: inline-flex; transform-origin: 50% 50%; }
.em-eye { margin-left: auto; width: 14px; height: 11px; color: ${theme.text.muted}; flex: none; }
.em-chip-row { position: absolute; left: 8px; top: ${layout.featureChromePx + 8}px; }
.em-slot { position: absolute; border: 1.5px dashed ${theme.borderActive}; border-radius: 10px; }
.em-slot--solid { border-style: solid; }
.em-shell-chip { position: absolute; }
.em-text { font-family: ${theme.fonts.mono}; font-size: ${layout.textPx}px; }
.em-label { fill: ${theme.text.plain}; font-weight: 500; }
.em-dim { fill: ${theme.text.plain}; }
.em-word { font-size: ${layout.wordPx}px; font-weight: 600; }
`
}

/**
 * A host page and the feature it mounts, seen at whatever moments a script asks for.
 *
 * The host is a browser-ish surface with an empty slot; the feature is a
 * smaller window that seats into it. Between the host's lamp and the seated
 * feature runs the wire, dashed until the handshake makes it a channel, and
 * everything the two say to each other is a dot crossing it. The ring beside
 * the lamp is the host's watchdog, the shutter across the wire is a close in
 * progress, and the document is the draft that gets out before it shuts.
 */
export const embedStage: Stage<EmbedConfig> = defineStage<EmbedConfig>({
  id: 'embed',

  styles: embedStyles,

  durationMs(config: EmbedConfig): number {
    return settledAt(config) + (config.restMs ?? 1000)
  },

  frame({ config, profile, theme, atMs }): string {
    const layout = embedLayout(profile, !config.script.some((event) => event.kind === 'dock'))
    const state = embedStateAt(config, atMs)
    return `<div class="em-frame">
      ${renderHost(layout, state, theme, config.mark, config.closeApi)}
      ${renderSlot(layout, state)}
      ${renderShellChip(layout, config.mark, config.shellApi)}
      ${renderFeature(layout, state, theme, config.mark, config.featureApi)}
      <svg class="em-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderWire(layout, state, theme)}
        ${renderRing(layout, state, theme)}
        ${renderBracket(layout, state, theme)}
        ${renderPort(layout, state, theme)}
        ${renderSocket(layout, state, theme)}
        ${renderGate(layout, state, theme)}
        ${renderFlights(layout, state, theme)}
        ${renderReceipt(layout, state, theme)}
        ${renderDraft(layout, state, theme, atMs)}
        ${renderFlash(layout, state, theme)}
      </svg>
    </div>`
  },
})
