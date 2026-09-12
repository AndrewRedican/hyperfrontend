import type { VaultPair } from '../models/vault'
import type { VaultContext } from './context'
import type { Box } from './layout'
import { abs, cos, max, PI } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { clamp01, easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { renderForeignLabel } from '../stage/api-chip'
import { renderScriptIcon } from './glyphs'
import { routeAt } from './layout'
import { ASK_MS, FALL_MS, FLASH_MS, FLIP_MS, SLIDE_MS, SNAP_MS } from './timeline'

/** How strongly a copy is drawn while it is on its way from the shelf to the vault. */
const GHOST_OPACITY = 0.6

/** Share of the fall over which a copy fades out and its chip fades in. */
const HANDOVER = 0.35

/** How small a copy is by the time it becomes a chip, relative to its tile: the chip's own size. */
const LANDED_SCALE = 0.55

/** Share of the fall over which a copy shrinks to its landed size, so it is chip-sized before it passes anything already in the vault. */
const SHRINK = 0.4

/** How strongly a flash washes over a tile's face at its peak; kept low so a GIF's palette does not speckle it. */
const WASH_OPACITY = 0.22

/**
 * Draw the shelf the globals stand on, with its name at the left end.
 *
 * @param context - The stage at this instant.
 * @returns HTML markup.
 * @example The shelf, drawn before the tiles that stand on it
 * ```ts
 * renderShelf(context)
 * ```
 */
export function renderShelf(context: VaultContext): string {
  const { layout, config } = context
  const { shelf, shelfLabel } = layout
  return `<div class="vt-shelf" style="left:${shelf.x}px;top:${shelf.y}px;width:${shelf.width}px;height:${shelf.height}px"></div>
<div class="vt-shelf__label" style="left:${shelfLabel.x}px;top:${shelfLabel.y}px">${escapeHtml(config.shelf)}</div>`
}

/**
 * The markup of one tile: the built-in's name, and once it is rewritten, the name struck through over what replaced it.
 *
 * @param pair - The built-in.
 * @param box - Where the tile sits.
 * @param tampered - Whether the intruder has rewritten it.
 * @param scaleX - How wide it is drawn, from 0 (edge on, mid flip) to 1.
 * @param extraClass - Further class names, for a copy on its way.
 * @param extraStyle - Further inline style, for a copy on its way.
 * @param washes - Inline markup for the flashes drawn over it.
 * @returns HTML markup.
 */
function tileMarkup(
  pair: VaultPair,
  box: Box,
  tampered: boolean,
  scaleX: number,
  extraClass: string,
  extraStyle: string,
  washes: string
): string {
  const classes = `vt-tile${tampered ? ' vt-tile--tampered' : ''}${extraClass === '' ? '' : ` ${extraClass}`}`
  const glyph = tampered ? `<span class="vt-tile__glyph">${escapeHtml(pair.replacement)}</span>` : ''
  return `<div class="${classes}" style="left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;transform:scaleX(${scaleX.toFixed(3)})${extraStyle}">${washes}${renderForeignLabel(pair.global)}${glyph}</div>`
}

/**
 * Draw every built-in's tile on the shelf as it stands at this instant.
 *
 * A tile flashes in the accent as its copy is photographed off it, flips
 * edge on when the intruder's bolt strikes it and comes back rewritten, and
 * flashes in the danger tone whenever it is struck or asked.
 *
 * @param context - The stage at this instant.
 * @returns HTML markup.
 * @example The tiles, drawn over the shelf
 * ```ts
 * renderTiles(context)
 * ```
 */
export function renderTiles(context: VaultContext): string {
  const { config, layout, theme, timeline, atMs } = context
  return config.pairs
    .map((pair, index) => {
      const place = layout.pairs[index]
      const schedule = timeline.pairs[index]
      if (place === undefined || schedule === undefined) {
        return ''
      }
      const flip = progress(atMs, schedule.hitAt, FLIP_MS)
      const tampered = flip >= 0.5
      const scaleX = flip <= 0 || flip >= 1 ? 1 : abs(cos(PI * flip))
      const snap = pulse(atMs, schedule.captureAt, SNAP_MS)
      const danger = max(pulse(atMs, schedule.hitAt, FLASH_MS), pulse(atMs, schedule.shelfAskAt + ASK_MS, FLASH_MS))
      const washes = `<div class="vt-tile__wash" style="background:${theme.accent};opacity:${(snap * WASH_OPACITY).toFixed(3)}"></div><div class="vt-tile__wash" style="background:${theme.tones.danger};opacity:${(danger * WASH_OPACITY).toFixed(3)}"></div>`
      return tileMarkup(pair, place.tile, tampered, scaleX, '', '', washes)
    })
    .join('')
}

/**
 * Draw every copy on its way from the shelf into the vault.
 *
 * A copy is the tile itself at reduced opacity, detaching from where the
 * tile stands and falling along a curve into the open vault, shrinking as it
 * goes and fading out over the last stretch as the chip it becomes fades in.
 *
 * @param context - The stage at this instant.
 * @returns HTML markup, empty while no copy is on its way.
 * @example The copies, drawn above the vault so they pass through its opening
 * ```ts
 * renderGhosts(context)
 * ```
 */
export function renderGhosts(context: VaultContext): string {
  const { config, layout, timeline, atMs } = context
  return config.pairs
    .map((pair, index) => {
      const place = layout.pairs[index]
      const schedule = timeline.pairs[index]
      if (place === undefined || schedule === undefined) {
        return ''
      }
      const t = progress(atMs, schedule.captureAt, FALL_MS)
      if (t <= 0 || t >= 1) {
        return ''
      }
      const eased = easeInOut(t)
      const point = routeAt(place.fall, eased)
      const scale = lerp(1, LANDED_SCALE, clamp01(eased / SHRINK))
      const opacity = GHOST_OPACITY * (1 - easeOut(clamp01((t - (1 - HANDOVER)) / HANDOVER)))
      const box = {
        x: point.x - place.tile.width / 2,
        y: point.y - place.tile.height / 2,
        width: place.tile.width,
        height: place.tile.height,
      }
      return tileMarkup(pair, box, false, 1, 'vt-ghost', ` scale(${scale.toFixed(3)});opacity:${opacity.toFixed(3)}`, '')
    })
    .join('')
}

/**
 * Draw the intruder: a third-party script sliding in from the edge of the frame to sit over the shelf's right end.
 *
 * @param context - The stage at this instant.
 * @returns HTML markup, empty before the intruder sets off.
 * @example The intruder, drawn over the shelf
 * ```ts
 * renderIntruder(context)
 * ```
 */
export function renderIntruder(context: VaultContext): string {
  const { config, layout, metrics, theme, timeline, atMs } = context
  if (atMs < timeline.intruderAt) {
    return ''
  }
  const { intruder } = layout
  const x = lerp(layout.intruderStartX, intruder.x, easeOut(progress(atMs, timeline.intruderAt, SLIDE_MS)))
  return `<div class="vt-intruder" style="left:${x.toFixed(1)}px;top:${intruder.y}px;width:${intruder.width}px;height:${intruder.height}px">${renderScriptIcon(metrics.iconPx, theme.tones.danger)}<span class="vt-intruder__name">${escapeHtml(config.intruder)}</span></div>`
}
