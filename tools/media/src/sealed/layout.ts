import type { MediaProfile } from '../models/profile'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** The width the composition is designed at; every measurement scales from it. */
const DESIGN_WIDTH = 640

/** A point in the frame, in CSS pixels. */
export interface Point {
  /** Horizontal position. */
  x: number
  /** Vertical position. */
  y: number
}

/** A rectangle in the frame, in CSS pixels. */
export interface Box {
  /** Left edge. */
  x: number
  /** Top edge. */
  y: number
  /** Width. */
  width: number
  /** Height. */
  height: number
}

/** How the frame is sized for the surface it is being drawn for. */
export interface SealedMetrics {
  /** Margin between the drawing and the edge of the frame. */
  insetPx: number
  /** Width of an end node. */
  nodeWidthPx: number
  /** Height of an end node. */
  nodeHeightPx: number
  /** Corner radius of an end node. */
  nodeRadiusPx: number
  /** Distance between the pipe's two rails. */
  pipeGapPx: number
  /** Height of a frame, and of the card it wraps. */
  frameHeightPx: number
  /** Width of a frame's header strip. */
  headerWidthPx: number
  /** Width of a frame's sealed body. */
  bodyWidthPx: number
  /** Width of a frame's tag cap. */
  tagWidthPx: number
  /** Length of the key inside a node. */
  keyPx: number
  /** Length of the hollow key a hello rides as. */
  helloKeyPx: number
  /** Width of the listener's eye. */
  eyePx: number
  /** Width of the tray refused frames land in. */
  trayWidthPx: number
  /** Height of the tray. */
  trayHeightPx: number
  /** Font size of the end names. */
  namePx: number
  /** Font size of the hello label and the drop code. */
  monoPx: number
  /** Font size of the counter digit in a header strip. */
  digitPx: number
  /** Font size of the API chips. */
  chipPx: number
  /** Font size of the counter comparison. */
  comparePx: number
}

/** Where everything sits, measured once for the profile. */
export interface SealedLayout {
  /** Vertical centre of the pipe and of both nodes. */
  pipeY: number
  /** The sending end. */
  sender: Box
  /** The receiving end. */
  receiver: Box
  /** Left edge of the pipe, where it leaves the sender. */
  pipeX: number
  /** Right edge of the pipe, where it meets the receiver. */
  pipeRight: number
  /** The upper rail. */
  pipeTop: number
  /** The lower rail. */
  pipeBottom: number
  /** The lane the sender's hello rides, above the centre line. */
  helloOutY: number
  /** The lane the receiver's hello rides, below the centre line. */
  helloBackY: number
  /** Where the sender's hello label sits, above the upper rail. */
  helloOutLabelY: number
  /** Where the receiver's hello label sits, below the lower rail. */
  helloBackLabelY: number
  /** Horizontal centre of a frame while it is being wrapped, beside the sender. */
  frameStartX: number
  /** Horizontal centre of a frame when it reaches the receiver's edge. */
  frameEndX: number
  /** Centre of the listener's eye, under the pipe. */
  listener: Point
  /** Where the listener's copy parks, beside the eye. */
  parked: Point
  /** Control point of the arc the copy takes back into the pipe. */
  riseControl: Point
  /** Where the copy lands back in the pipe. */
  risen: Point
  /** The tray refused frames land in, under the receiver. */
  tray: Box
  /** Centre of a frame once it has landed in the tray. */
  landing: Point
  /** Control point of the fall from the receiver's edge into the tray. */
  fallControl: Point
  /** Right edge of the drop code, written in the tray beside the landed frame. */
  codeX: number
  /** Vertical centre of the counter comparison, above the stopped frame. */
  compareY: number
  /** Top of the channel chip, above the sender. */
  chipTop: number
  /** Horizontal centre of the drop chip, under the tray. */
  dropChipX: number
  /** Top of the drop chip. */
  dropChipTop: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * Everything scales with the profile's width, so the wide profile gets the
 * same composition at a larger size rather than the same size with more room
 * around it.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 * @example The compact profile's frame height
 * ```ts
 * sealedMetrics(resolveProfile('compact')).frameHeightPx // 22
 * ```
 */
export function sealedMetrics(profile: MediaProfile): SealedMetrics {
  const unit = profile.width / DESIGN_WIDTH
  return {
    insetPx: round(22 * unit),
    nodeWidthPx: round(110 * unit),
    nodeHeightPx: round(90 * unit),
    nodeRadiusPx: round(12 * unit),
    pipeGapPx: round(26 * unit),
    frameHeightPx: round(22 * unit),
    headerWidthPx: round(20 * unit),
    bodyWidthPx: round(58 * unit),
    tagWidthPx: round(14 * unit),
    keyPx: round(30 * unit),
    helloKeyPx: round(22 * unit),
    eyePx: round(26 * unit),
    trayWidthPx: round(178 * unit),
    trayHeightPx: round(34 * unit),
    namePx: round(12 * unit),
    monoPx: round(11 * unit),
    digitPx: round(11 * unit),
    chipPx: round(12 * unit),
    comparePx: round(13 * unit),
  }
}

/**
 * Lay the composition out across the frame.
 *
 * Two ends with a pipe between them across the upper half, the listener and
 * the tray in the lower half. Every position is derived from the pipe's
 * centre line so the whole drawing can be moved by one number.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param profile - The presentation target being composed for.
 * @returns Where everything sits.
 * @example Where a frame stops at the receiver's edge
 * ```ts
 * sealedLayout(sealedMetrics(profile), profile).frameEndX
 * ```
 */
export function sealedLayout(metrics: SealedMetrics, profile: MediaProfile): SealedLayout {
  const unit = profile.width / DESIGN_WIDTH
  const pipeY = round(122 * unit)
  const halfGap = metrics.pipeGapPx / 2
  const frameWidth = metrics.headerWidthPx + metrics.bodyWidthPx + metrics.tagWidthPx
  const senderX = round(40 * unit)
  const sender = { x: senderX, y: pipeY - metrics.nodeHeightPx / 2, width: metrics.nodeWidthPx, height: metrics.nodeHeightPx }
  const receiver = { ...sender, x: profile.width - senderX - metrics.nodeWidthPx }
  const pipeX = sender.x + sender.width
  const pipeRight = receiver.x
  const trayX = profile.width - round(26 * unit) - metrics.trayWidthPx
  const tray = { x: trayX, y: pipeY + round(134 * unit), width: metrics.trayWidthPx, height: metrics.trayHeightPx }
  const landing = { x: tray.x + tray.width - round(8 * unit) - frameWidth / 2, y: tray.y + tray.height / 2 }
  const listener = { x: round(318 * unit), y: pipeY + round(108 * unit) }
  const parked = { x: round(252 * unit), y: listener.y }
  const frameEndX = pipeRight - round(10 * unit) - frameWidth / 2
  return {
    pipeY,
    sender,
    receiver,
    pipeX,
    pipeRight,
    pipeTop: pipeY - halfGap,
    pipeBottom: pipeY + halfGap,
    helloOutY: pipeY - round(6.5 * unit),
    helloBackY: pipeY + round(6.5 * unit),
    helloOutLabelY: pipeY - halfGap - round(9 * unit),
    helloBackLabelY: pipeY + halfGap + round(10 * unit),
    frameStartX: pipeX + round(12 * unit) + frameWidth / 2,
    frameEndX,
    listener,
    parked,
    riseControl: { x: parked.x - round(30 * unit), y: round((parked.y + pipeY) / 2) - round(10 * unit) },
    risen: { x: parked.x + round(30 * unit), y: pipeY },
    tray,
    landing,
    fallControl: { x: frameEndX + round(6 * unit), y: landing.y - round(20 * unit) },
    codeX: landing.x - frameWidth / 2 - round(10 * unit),
    compareY: pipeY - halfGap - round(12 * unit),
    chipTop: sender.y - round(28 * unit),
    dropChipX: tray.x + tray.width / 2,
    dropChipTop: tray.y + tray.height + round(8 * unit),
  }
}
