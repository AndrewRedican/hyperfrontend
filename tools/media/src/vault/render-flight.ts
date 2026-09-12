import type { VaultContext } from './context'
import type { Route } from './layout'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { clamp01, easeIn, easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { renderDot, renderLock } from './glyphs'
import { routeAt } from './layout'
import { chipGlow } from './render-vault'
import { ASK_MS, BAND_MS, BOLT_MS, LOCK_MS, SNAP_MS } from './timeline'

/** Share of the route a bolt's tail trails its head by. */
const BOLT_TAIL = 0.22

/** How many straight pieces a bolt is drawn in, so it follows its curve. */
const BOLT_PIECES = 6

/** Share of the ask over which a dot shrinks into the tile or the chip. */
const ABSORB = 0.15

/** How far the halo around a struck or asked actor stands off its edge, in pixels. */
const HALO_GAP = 5

/** How strongly the band's outline is drawn once it has appeared. */
const BAND_STROKE = 0.9

/**
 * The `points` of a polyline along part of a route.
 *
 * @param route - The path the bolt follows.
 * @param from - Where the piece starts, from 0 to 1.
 * @param to - Where it ends.
 * @returns Space-separated coordinate pairs.
 */
function polyline(route: Route, from: number, to: number): string {
  const points: string[] = []
  for (let index = 0; index <= BOLT_PIECES; index += 1) {
    const point = routeAt(route, lerp(from, to, index / BOLT_PIECES))
    points.push(`${point.x.toFixed(1)},${point.y.toFixed(1)}`)
  }
  return points.join(' ')
}

/**
 * Draw the intruder's bolts: short danger-toned strokes that leave the
 * intruder and arc over the shelf to strike each tile in turn.
 *
 * @param context - The stage at this instant.
 * @returns SVG markup, empty while no bolt is in flight.
 * @example The bolts, drawn over the tiles
 * ```ts
 * renderBolts(context)
 * ```
 */
export function renderBolts(context: VaultContext): string {
  const { layout, metrics, theme, timeline, atMs } = context
  return layout.pairs
    .map((place, index) => {
      const schedule = timeline.pairs[index]
      if (schedule === undefined) {
        return ''
      }
      const t = progress(atMs, schedule.boltAt, BOLT_MS)
      if (t <= 0 || t >= 1) {
        return ''
      }
      const head = easeIn(t)
      const tail = clamp01(head - BOLT_TAIL)
      const tip = routeAt(place.bolt, head)
      return `<polyline points="${polyline(place.bolt, tail, head)}" fill="none" stroke="${theme.tones.danger}" stroke-width="${metrics.boltPx}" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/><circle cx="${tip.x.toFixed(1)}" cy="${tip.y.toFixed(1)}" r="${metrics.boltPx * 3}" fill="${theme.tones.danger}" opacity="0.25"/><circle cx="${tip.x.toFixed(1)}" cy="${tip.y.toFixed(1)}" r="${metrics.boltPx * 1.4}" fill="${theme.tones.danger}"/>`
    })
    .join('')
}

/**
 * Draw every question dot on its way to a tile or a chip.
 *
 * A dot leaves its slot, follows its route and shrinks into whatever it
 * reaches, so the question is seen to go in rather than stop outside.
 *
 * @param context - The stage at this instant.
 * @returns SVG markup, empty while no question is in flight.
 * @example The dots, drawn over the cards they cross
 * ```ts
 * renderDots(context)
 * ```
 */
export function renderDots(context: VaultContext): string {
  const { layout, metrics, theme, timeline, atMs } = context
  const one = (route: Route, askAt: number): string => {
    const t = progress(atMs, askAt, ASK_MS)
    if (t <= 0 || t >= 1) {
      return ''
    }
    const radius = metrics.dotPx * (1 - easeIn(clamp01((t - (1 - ABSORB)) / ABSORB)))
    return renderDot(routeAt(route, easeInOut(t)), radius, theme.accent)
  }
  return layout.pairs
    .map((place, index) => {
      const schedule = timeline.pairs[index]
      return schedule === undefined ? '' : `${one(place.shelfRoute, schedule.shelfAskAt)}${one(place.vaultRoute, schedule.vaultAskAt)}`
    })
    .join('')
}

/**
 * Draw the halos: the accent ring around a tile as its copy is photographed
 * off it, and the success ring around the vault and the chip a question has
 * just reached.
 *
 * @param context - The stage at this instant.
 * @returns SVG markup, empty while nothing is lit.
 * @example The halos, drawn under the dots
 * ```ts
 * renderHalos(context)
 * ```
 */
export function renderHalos(context: VaultContext): string {
  const { layout, metrics, theme, timeline, atMs } = context
  const { vault } = layout
  let vaultGlow = 0
  const rings = layout.pairs
    .map((place, index) => {
      const schedule = timeline.pairs[index]
      if (schedule === undefined) {
        return ''
      }
      const snap = pulse(atMs, schedule.captureAt, SNAP_MS)
      const glow = chipGlow(context, index)
      vaultGlow = max(vaultGlow, glow)
      const tile = place.tile
      const tileRing =
        snap <= 0
          ? ''
          : `<rect x="${tile.x - HALO_GAP}" y="${tile.y - HALO_GAP}" width="${tile.width + HALO_GAP * 2}" height="${tile.height + HALO_GAP * 2}" rx="${HALO_GAP + 10}" fill="none" stroke="${theme.accent}" stroke-width="2" opacity="${(snap * 0.9).toFixed(3)}"/>`
      const chipRing =
        glow <= 0
          ? ''
          : `<circle cx="${place.chip.x}" cy="${place.chip.y}" r="${(metrics.chipPx * 2.4 + 6 * glow).toFixed(1)}" fill="${theme.tones.success}" opacity="${(glow * 0.16).toFixed(3)}"/>`
      return `${tileRing}${chipRing}`
    })
    .join('')
  const vaultRing =
    vaultGlow <= 0
      ? ''
      : `<rect x="${vault.x - HALO_GAP}" y="${vault.y - HALO_GAP}" width="${vault.width + HALO_GAP * 2}" height="${vault.height + HALO_GAP * 2}" rx="${HALO_GAP + 14}" fill="none" stroke="${theme.tones.success}" stroke-width="2" opacity="${(vaultGlow * 0.85).toFixed(3)}"/>`
  return `${vaultRing}${rings}`
}

/**
 * Draw the lock popping onto the shut lid.
 *
 * @param context - The stage at this instant.
 * @returns SVG markup, empty before the lid is shut.
 * @example The lock, drawn over the lid
 * ```ts
 * renderLockGlyph(context)
 * ```
 */
export function renderLockGlyph(context: VaultContext): string {
  const { layout, metrics, theme, timeline, atMs } = context
  const pop = easeOut(progress(atMs, timeline.lockedAt, LOCK_MS))
  if (pop <= 0) {
    return ''
  }
  return renderLock(layout.lock, metrics.lockPx, theme.accent, theme.surfaceRaised, lerp(0.5, 1, pop), pop)
}

/**
 * Draw the band that settles under the vault column once every copy has answered.
 *
 * The band is a raised surface outlined in the success tone rather than a
 * translucent tint: a tint would be a colour of its own that a GIF's palette,
 * settled on the first frame, does not hold, so it would come out dithered;
 * the raised surface is already on the shelf tiles and the value field.
 *
 * @param context - The stage at this instant.
 * @returns SVG markup, empty before the band appears.
 * @example The band, drawn under the answers
 * ```ts
 * renderBand(context)
 * ```
 */
export function renderBand(context: VaultContext): string {
  const { layout, theme, timeline, atMs } = context
  const reveal = easeOut(progress(atMs, timeline.bandAt, BAND_MS))
  if (reveal <= 0) {
    return ''
  }
  const { band } = layout
  const shape = `x="${band.x}" y="${band.y}" width="${band.width}" height="${band.height}" rx="12"`
  return `<rect ${shape} fill="${theme.surfaceRaised}" opacity="${reveal.toFixed(3)}"/><rect ${shape} fill="none" stroke="${theme.tones.success}" stroke-opacity="${(BAND_STROKE * reveal).toFixed(3)}" stroke-width="1.5"/>`
}
