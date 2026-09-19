import type { MediaProfile } from '../models/profile'
import type { Point, Rect } from '../stage/geometry'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Where everything in the composition sits for one profile. */
export interface ComposeLayout {
  /** The host page's window. */
  host: Rect
  /** Height of the host's chrome bar. */
  hostChromePx: number
  /** The host's own header bar, across the top of its content. */
  navBar: Rect
  /** The placeholder lines of the host's own rail. */
  railBars: readonly Rect[]
  /** Where every wire meets, inside the host's rail. */
  hub: Point
  /** The dashed outlines the features seat into, top to bottom. */
  slots: readonly Rect[]
  /** Where each feature window sits once seated, index for index with the slots. */
  seats: readonly Rect[]
  /** Where each feature window starts, outside the host. */
  origins: readonly Rect[]
  /** The path of each wire, from the hub to its slot's edge. */
  wires: readonly (readonly Point[])[]
  /** Height of a feature window's chrome bar. */
  featureChromePx: number
  /** Font size of the origins and the message labels. */
  textPx: number
  /** Font size of a framework tag. */
  tagPx: number
}

/** Margin between the drawing and the edge of the frame. */
const INSET_PX = 24

/** Height of the host's chrome bar. */
const HOST_CHROME_PX = 26

/** Height of a feature window's chrome bar. */
const FEATURE_CHROME_PX = 16

/** Gap between a slot's outline and the window seated in it. */
const SLOT_GAP_PX = 4

/** Vertical gap between two slots. */
const SLOT_STEP_PX = 12

/** Width of the host's rail, where the hub sits. */
const RAIL_W = 100

/** Width of a feature window before it docks. */
const ORIGIN_W = 150

/** Height of a feature window before it docks. */
const ORIGIN_H = 100

/**
 * Lay the composition out for one profile.
 *
 * The host takes the left three fifths of the frame. Its content is a rail
 * on the left and a stack of slots on the right, one per feature, so every
 * wire from the hub in the rail reaches its slot without crossing another.
 * The features start against the right edge of the frame, one above the
 * other in the order they dock, so the gap between them and the host is the
 * distance each one crosses.
 *
 * @param profile - The presentation target being composed for.
 * @param count - How many features the scene seats.
 * @returns Every position the renderer needs.
 * @example The three slots of the readme hero
 * ```ts
 * composeLayout(profile, 3).slots.length // 3
 * ```
 */
export function composeLayout(profile: MediaProfile, count: number): ComposeLayout {
  const host: Rect = { x: INSET_PX, y: INSET_PX + 6, w: round(profile.width * 0.6), h: profile.height - 2 * INSET_PX - 6 }
  const contentTop = host.y + HOST_CHROME_PX + 14
  const railX = host.x + 16
  const navBar: Rect = { x: railX, y: contentTop, w: round(host.w * 0.5), h: 9 }
  const railBars: readonly Rect[] = [
    { x: railX, y: contentTop + 28, w: 76, h: 7 },
    { x: railX, y: contentTop + 44, w: 56, h: 5 },
    { x: railX, y: contentTop + 58, w: 66, h: 5 },
  ]
  const slotX = railX + RAIL_W + 28
  const slotW = host.x + host.w - 16 - slotX
  const slotTop = contentTop + 28
  const slotBottom = host.y + host.h - 16
  const slotH = round((slotBottom - slotTop - SLOT_STEP_PX * (count - 1)) / count)
  const slots: Rect[] = []
  for (let index = 0; index < count; index += 1) {
    slots.push({ x: slotX, y: slotTop + index * (slotH + SLOT_STEP_PX), w: slotW, h: slotH })
  }
  const seats = slots.map((slot) => ({
    x: slot.x + SLOT_GAP_PX,
    y: slot.y + SLOT_GAP_PX,
    w: slot.w - 2 * SLOT_GAP_PX,
    h: slot.h - 2 * SLOT_GAP_PX,
  }))
  const hub: Point = { x: railX + 22, y: slotTop + (slotH * count + SLOT_STEP_PX * (count - 1)) / 2 }
  const spineX = railX + 70
  const wires = slots.map((slot) => {
    const mid = slot.y + slot.h / 2
    return [hub, { x: spineX, y: hub.y }, { x: spineX, y: mid }, { x: slot.x - 2, y: mid }]
  })
  const origins = slots.map((_, index) => ({
    x: profile.width - INSET_PX - ORIGIN_W - 12,
    y: host.y + 28 + index * (ORIGIN_H + 24),
    w: ORIGIN_W,
    h: ORIGIN_H,
  }))
  return {
    host,
    hostChromePx: HOST_CHROME_PX,
    navBar,
    railBars,
    hub,
    slots,
    seats,
    origins,
    wires,
    featureChromePx: FEATURE_CHROME_PX,
    textPx: 10.5,
    tagPx: 11.5,
  }
}
