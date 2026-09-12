import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { VaultConfig } from '../models/vault'
import type { VaultContext } from './context'
import { apiChipStyles } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { vaultLayout, vaultMetrics } from './layout'
import { renderAnswers, renderAsker } from './render-asker'
import { renderBand, renderBolts, renderDots, renderHalos, renderLockGlyph } from './render-flight'
import { renderGhosts, renderIntruder, renderShelf, renderTiles } from './render-shelf'
import { renderLid, renderVault } from './render-vault'
import { vaultTimeline } from './timeline'

/**
 * Build the stylesheet for one vault, with its theme resolved into it.
 *
 * @param config - The scene as configured.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function vaultStyles(config: VaultConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = vaultMetrics(profile)
  const mono = `font-family: ${theme.fonts.mono};`
  return `
${apiChipStyles(theme, metrics.chipPx)}
.vt-frame { position: absolute; inset: 0; }
.vt-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; pointer-events: none; }
.vt-shelf { position: absolute; border-radius: 10px; background: ${theme.surface}; border: 1.5px solid ${theme.border}; border-bottom: 4px solid ${theme.rule}; box-shadow: ${theme.shadow}; }
.vt-shelf__label { position: absolute; transform: translateY(-50%); ${mono} font-size: ${metrics.smallPx}px; color: ${theme.text.faint}; white-space: nowrap; }
.vt-tile { position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 10px; background: ${theme.surfaceRaised}; border: 1.5px solid ${theme.border}; box-shadow: ${theme.shadow}; transform-origin: center; overflow: hidden; }
.vt-tile--tampered { border-color: ${theme.tones.danger}; }
.vt-tile--tampered .api-foreign { text-decoration: line-through; text-decoration-color: ${theme.tones.danger}; text-decoration-thickness: 1.5px; }
.vt-tile__glyph { ${mono} font-size: ${metrics.smallPx}px; line-height: 1; color: ${theme.tones.danger}; white-space: nowrap; }
.vt-tile__wash { position: absolute; inset: 0; }
.vt-ghost { box-shadow: none; }
.vt-vault { position: absolute; border-radius: 14px; background: ${theme.surface}; border: 1.5px solid ${theme.border}; border-top-color: transparent; box-shadow: ${theme.shadow}; }
.vt-vault__mark { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: ${theme.accent}; }
.vt-vault__mark svg { width: 100%; height: 100%; display: block; }
.vt-opening { position: absolute; height: 0; border-top: 1.5px dashed ${theme.border}; }
.vt-chip { position: absolute; transform-origin: center; }
.vt-subpath { position: absolute; transform: translate(-50%, -50%); ${mono} font-size: ${metrics.smallPx}px; color: ${theme.text.faint}; white-space: nowrap; }
.vt-lid { position: absolute; border-radius: 5px; background: ${theme.surfaceRaised}; border: 1.5px solid ${theme.border}; box-shadow: ${theme.shadow}; }
.vt-lid__slot { position: absolute; top: 50%; width: 18px; height: 4px; border-radius: 2px; background: ${theme.text.faint}; opacity: 0.7; transform: translate(-50%, -50%); }
.vt-asker { position: absolute; border-radius: 14px; background: ${theme.surface}; border: 1.5px solid ${theme.border}; box-shadow: ${theme.shadow}; }
.vt-pictogram { position: absolute; width: ${metrics.pictogramPx}px; height: ${metrics.pictogramPx}px; }
.vt-pictogram svg { display: block; }
.vt-value { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: ${theme.surfaceRaised}; border: 1px solid ${theme.rule}; ${mono} font-size: ${metrics.monoPx}px; color: ${theme.text.plain}; white-space: nowrap; }
.vt-slot { position: absolute; border-radius: 9px; border: 1.5px dashed ${theme.border}; }
.vt-slot--active { border-color: ${theme.borderActive}; }
.vt-pill { position: absolute; display: inline-flex; align-items: center; height: ${metrics.pillHeightPx}px; padding: 0 8px; border-radius: 7px; background: ${theme.surfaceRaised}; border: 1.5px solid; ${mono} font-size: ${metrics.monoPx}px; font-weight: 600; line-height: 1; white-space: nowrap; transform-origin: center; }
.vt-intruder { position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border-radius: 12px; background: ${theme.surfaceRaised}; border: 1.5px solid ${theme.tones.danger}; box-shadow: ${theme.shadow}; }
.vt-intruder svg { display: block; }
.vt-intruder__name { ${mono} font-size: ${metrics.monoPx}px; line-height: 1; color: ${theme.text.plain}; white-space: nowrap; }
`
}

/**
 * A shelf of globals, a vault, an asker, and an intruder.
 *
 * At start-up each built-in on the shelf is photographed: a copy of its tile
 * detaches and falls into the open vault, where it becomes the package's own
 * chip with its import subpath under it. The lid slides shut and a lock pops
 * on. A third-party script then slides in over the shelf's right end and
 * strikes each tile with a bolt; the tile flips edge on and comes back with
 * its name struck through and what replaced it written underneath. The asker
 * then asks each question twice: a dot leaves the slot, reaches the shelf's
 * tile and an answer in the danger tone comes back; a dot leaves the next
 * slot, enters the shut vault through the slot in its lid, reaches the chip,
 * and an answer in the success tone comes back. When every answer has landed
 * a band settles under the vault's column.
 */
export const vaultStage: Stage<VaultConfig> = defineStage<VaultConfig>({
  id: 'vault',

  styles: vaultStyles,

  durationMs(config: VaultConfig): number {
    return vaultTimeline(config).settledAt + (config.restMs ?? 900)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = vaultMetrics(profile)
    const layout = vaultLayout(metrics, profile, config.pairs.length)
    const timeline = vaultTimeline(config)
    const context: VaultContext = { config, layout, metrics, theme, timeline, atMs }
    return `<div class="vt-frame">
      ${renderShelf(context)}
      ${renderTiles(context)}
      ${renderVault(context)}
      ${renderLid(context)}
      ${renderAsker(context)}
      ${renderGhosts(context)}
      ${renderIntruder(context)}
      <svg class="vt-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderBand(context)}
        ${renderHalos(context)}
        ${renderLockGlyph(context)}
        ${renderBolts(context)}
        ${renderDots(context)}
      </svg>
      ${renderAnswers(context)}
    </div>`
  },
})
