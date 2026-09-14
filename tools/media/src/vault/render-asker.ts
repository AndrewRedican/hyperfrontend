import type { VaultContext } from './context'
import type { Box, Route } from './layout'
import { escapeHtml } from '../lib/escape-html'
import { clamp01, easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { renderShelfPictogram, renderVaultPictogram } from './glyphs'
import { routeAt } from './layout'
import { REPLY_MS, SLOT_FADE_MS } from './timeline'

/** How long an answer takes to grow to full size as it leaves the tile or the chip. */
const EMERGE_MS = 180

/** How small an answer is the instant it leaves. */
const EMERGE_SCALE = 0.4

/** How much an answer bumps as it lands in its slot. */
const LANDING_BUMP = 0.1

/** How long the landing bump lasts. */
const LANDING_MS = 320

/** One answer's whereabouts, for the pill renderer. */
interface AnswerTrip {
  /** The route back from the tile or the chip to the slot. */
  route: Route
  /** When the answer leaves. */
  replyAt: number
  /** When it lands. */
  landAt: number
  /** The answer itself. */
  text: string
  /** What it is drawn in. */
  colour: string
}

/**
 * Draw one empty answer slot, lit while its question is out and fading as its answer lands.
 *
 * @param context - The stage at this instant.
 * @param box - Where the slot sits.
 * @param askAt - When its question leaves.
 * @param landAt - When its answer lands.
 * @returns HTML markup, empty once the slot has faded.
 */
function renderSlot(context: VaultContext, box: Box, askAt: number, landAt: number): string {
  const { atMs } = context
  const fade = easeOut(progress(atMs, landAt - SLOT_FADE_MS, SLOT_FADE_MS))
  if (fade >= 1) {
    return ''
  }
  const active = atMs >= askAt && atMs < landAt
  return `<div class="vt-slot${active ? ' vt-slot--active' : ''}" style="left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;opacity:${(1 - fade).toFixed(3)}"></div>`
}

/**
 * Draw the asker: a card with an empty slot for each answer, a pictogram at
 * the outer corner of each column saying whether it answers from the shelf
 * or from the vault, and the value the questions are asked about in a field
 * along the bottom.
 *
 * @param context - The stage at this instant.
 * @returns HTML markup.
 * @example The asker, drawn beside the vault
 * ```ts
 * renderAsker(context)
 * ```
 */
export function renderAsker(context: VaultContext): string {
  const { config, layout, metrics, theme, timeline } = context
  const { asker, valueField, shelfPictogram, vaultPictogram } = layout
  const slots = layout.pairs
    .map((place, index) => {
      const schedule = timeline.pairs[index]
      if (schedule === undefined) {
        return ''
      }
      return `${renderSlot(context, place.shelfSlot, schedule.shelfAskAt, schedule.shelfLandAt)}${renderSlot(context, place.vaultSlot, schedule.vaultAskAt, schedule.vaultLandAt)}`
    })
    .join('')
  const half = metrics.pictogramPx / 2
  const pictograms = `<div class="vt-pictogram" style="left:${shelfPictogram.x - half}px;top:${shelfPictogram.y - half}px">${renderShelfPictogram(metrics.pictogramPx, theme.text.muted)}</div><div class="vt-pictogram" style="left:${vaultPictogram.x - half}px;top:${vaultPictogram.y - half}px">${renderVaultPictogram(metrics.pictogramPx, theme.text.muted)}</div>`
  const value = `<div class="vt-value" style="left:${valueField.x}px;top:${valueField.y}px;width:${valueField.width}px;height:${valueField.height}px">${escapeHtml(config.value)}</div>`
  return `<div class="vt-asker" style="left:${asker.x}px;top:${asker.y}px;width:${asker.width}px;height:${asker.height}px"></div>${pictograms}${slots}${value}`
}

/**
 * Draw one answer on its way back to its slot, or resting in it.
 *
 * @param context - The stage at this instant.
 * @param trip - The answer and its route.
 * @returns HTML markup, empty before the answer leaves.
 */
function renderAnswer(context: VaultContext, trip: AnswerTrip): string {
  const { atMs } = context
  if (atMs < trip.replyAt) {
    return ''
  }
  const travelled = easeInOut(progress(atMs, trip.replyAt, REPLY_MS))
  const point = routeAt(trip.route, 1 - travelled)
  const emerged = lerp(EMERGE_SCALE, 1, easeOut(progress(atMs, trip.replyAt, EMERGE_MS)))
  const bump = 1 + LANDING_BUMP * pulse(atMs, trip.landAt, LANDING_MS)
  const scale = emerged * bump
  const opacity = clamp01(progress(atMs, trip.replyAt, EMERGE_MS / 2))
  return `<div class="vt-pill" style="left:${point.x.toFixed(1)}px;top:${point.y.toFixed(1)}px;color:${trip.colour};border-color:${trip.colour};opacity:${opacity.toFixed(3)};transform:translate(-50%,-50%) scale(${scale.toFixed(3)})">${escapeHtml(trip.text)}</div>`
}

/**
 * Draw every answer that has left its tile or chip: on its way back along
 * the route its question took, or landed in its slot.
 *
 * @param context - The stage at this instant.
 * @returns HTML markup.
 * @example The answers, drawn last so they pass over everything
 * ```ts
 * renderAnswers(context)
 * ```
 */
export function renderAnswers(context: VaultContext): string {
  const { config, layout, theme, timeline } = context
  return config.pairs
    .map((pair, index) => {
      const place = layout.pairs[index]
      const schedule = timeline.pairs[index]
      if (place === undefined || schedule === undefined) {
        return ''
      }
      const shelf: AnswerTrip = {
        route: place.shelfRoute,
        replyAt: schedule.shelfReplyAt,
        landAt: schedule.shelfLandAt,
        text: pair.shelfAnswer,
        colour: theme.tones.danger,
      }
      const vault: AnswerTrip = {
        route: place.vaultRoute,
        replyAt: schedule.vaultReplyAt,
        landAt: schedule.vaultLandAt,
        text: pair.vaultAnswer,
        colour: theme.tones.success,
      }
      return `${renderAnswer(context, shelf)}${renderAnswer(context, vault)}`
    })
    .join('')
}
