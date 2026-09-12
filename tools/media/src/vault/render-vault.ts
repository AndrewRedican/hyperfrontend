import type { VaultContext } from './context'
import { renderMark } from '../banner/mark'
import { escapeHtml } from '../lib/escape-html'
import { clamp01, easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { renderApiChip } from '../stage/api-chip'
import { ASK_MS, FALL_MS, FLASH_MS, LID_MS } from './timeline'

/** Share of the fall over which a chip fades in as its copy fades out. */
const HANDOVER = 0.35

/** How small a chip starts before it settles at full size. */
const ARRIVING_SCALE = 0.7

/** How much a chip swells when a question reaches it. */
const SWELL = 0.1

/** How strongly the package mark is watermarked inside the vault. */
const WATERMARK_OPACITY = 0.09

/**
 * How far the lid has slid shut at this instant, from 0 (open) to 1 (shut).
 *
 * @param context - The stage at this instant.
 * @returns Eased progress of the lid.
 * @example Whether the lid is shut
 * ```ts
 * lidShut(context) >= 1
 * ```
 */
function lidShut(context: VaultContext): number {
  return easeInOut(progress(context.atMs, context.timeline.lidAt, LID_MS))
}

/**
 * How strongly one chip is lit because a question has just reached it.
 *
 * @param context - The stage at this instant.
 * @param index - Which built-in.
 * @returns Intensity from 0 to 1.
 * @example The first chip's glow
 * ```ts
 * chipGlow(context, 0)
 * ```
 */
export function chipGlow(context: VaultContext, index: number): number {
  const schedule = context.timeline.pairs[index]
  return schedule === undefined ? 0 : pulse(context.atMs, schedule.vaultAskAt + ASK_MS, FLASH_MS)
}

/**
 * Draw the vault: its box, the package mark watermarked inside, the dashed
 * opening along its top while the lid is off it, and every chip that has
 * landed with its import subpath written under it.
 *
 * @param context - The stage at this instant.
 * @returns HTML markup.
 * @example The vault, drawn before the copies that fall into it
 * ```ts
 * renderVault(context)
 * ```
 */
export function renderVault(context: VaultContext): string {
  const { config, layout, metrics, timeline, atMs } = context
  const { vault, lid, lidOpenWidth } = layout
  const chips = config.pairs
    .map((pair, index) => {
      const place = layout.pairs[index]
      const schedule = timeline.pairs[index]
      if (place === undefined || schedule === undefined) {
        return ''
      }
      const t = progress(atMs, schedule.captureAt, FALL_MS)
      const reveal = easeOut(clamp01((t - (1 - HANDOVER)) / HANDOVER))
      if (reveal <= 0) {
        return ''
      }
      const scale = lerp(ARRIVING_SCALE, 1, reveal) * (1 + SWELL * chipGlow(context, index))
      return `<div class="vt-chip" style="left:${place.chip.x}px;top:${place.chip.y}px;opacity:${reveal.toFixed(3)};transform:translate(-50%,-50%) scale(${scale.toFixed(3)})">${renderApiChip(pair.copy, config.mark)}</div>
<div class="vt-subpath" style="left:${place.chip.x}px;top:${place.subpathY}px;opacity:${reveal.toFixed(3)}">${escapeHtml(pair.subpath)}</div>`
    })
    .join('')
  const openingLeft = lid.x + lidOpenWidth
  const opening = `<div class="vt-opening" style="left:${openingLeft}px;top:${vault.y}px;width:${vault.x + vault.width - openingLeft}px"></div>`
  return `<div class="vt-vault" style="left:${vault.x}px;top:${vault.y}px;width:${vault.width}px;height:${vault.height}px">
  <div class="vt-vault__mark" style="width:${metrics.watermarkPx}px;height:${metrics.watermarkPx}px;opacity:${WATERMARK_OPACITY}">${renderMark(config.mark, 'vt-vault__svg')}</div>
</div>${opening}${chips}`
}

/**
 * Draw the lid: a bar across the vault's top that starts retracted to the
 * left and slides across to shut it, with the slot a question enters through
 * once it covers that point.
 *
 * @param context - The stage at this instant.
 * @returns HTML markup.
 * @example The lid, drawn above the chips it covers
 * ```ts
 * renderLid(context)
 * ```
 */
export function renderLid(context: VaultContext): string {
  const { layout } = context
  const { lid, lidOpenWidth, lidSlot } = layout
  const width = lerp(lidOpenWidth, lid.width, lidShut(context))
  const slot = lid.x + width >= lidSlot.x + 12 ? `<div class="vt-lid__slot" style="left:${lidSlot.x - lid.x}px"></div>` : ''
  return `<div class="vt-lid" style="left:${lid.x}px;top:${lid.y}px;width:${width.toFixed(1)}px;height:${lid.height}px">${slot}</div>`
}
