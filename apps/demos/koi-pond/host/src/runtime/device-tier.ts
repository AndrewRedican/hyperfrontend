/**
 * How many koi a device can hold, from what it reports about itself.
 *
 * Every koi is an independent app in its own frame with its own WebGL context,
 * so the size of the shoal is the single number that decides whether a device
 * carries the whole scene or the browser starts reclaiming frames underneath
 * it. That number comes from capability signals only: nothing here reads a
 * user-agent string, and no browser is named or special-cased.
 *
 * Two signals carry it. `navigator.deviceMemory` is a coarse figure in
 * gigabytes, rounded down by the browser and exposed only by Chromium;
 * `navigator.hardwareConcurrency` is the count of logical processors and is
 * available almost everywhere. A withheld signal is never read as evidence of
 * a weak device: unknown means middle, so a browser that says nothing about
 * its memory still seats a middle shoal rather than the smallest one.
 */

/** How capable a device is, by the hardware it reports. */
export type DeviceTier = 'low' | 'middle' | 'high'

/**
 * The most koi a shoal holds in each tier.
 *
 * Eight frameworks swim in this pond: the low cap thins the shoal, the middle
 * cap seats it exactly, and only the high cap has headroom past one koi per
 * framework.
 */
export const SHOAL_CAP: Record<DeviceTier, number> = {
  low: 4,
  middle: 8,
  high: 12,
}

/**
 * The hardware a browser reports about its device.
 *
 * The live `navigator` satisfies this shape as it stands. Both signals are
 * optional: `deviceMemory` is absent outside Chromium and is not part of the
 * standard navigator type at all, and a browser is free to withhold its core
 * count too.
 */
export interface DeviceSignals {
  /** Approximate device memory in gigabytes, coarsely rounded by the browser. */
  deviceMemory?: number
  /** Logical processors available to the page. */
  hardwareConcurrency?: number
}

/** A device's tier and the shoal ceiling that follows from it. */
export interface DeviceProfile {
  /** The tier the reported hardware places the device in. */
  tier: DeviceTier
  /** The most koi the shoal holds on this device. */
  cap: number
}

/**
 * Places a device in its tier.
 *
 * A device is low when it reports at most 2GB of memory or at most 4 cores,
 * high when it reports at least 8GB and at least 8 cores, and middle for
 * everything between those and for anything it declines to report.
 *
 * @param signals - What the browser reports about the hardware.
 * @returns The tier the device belongs to.
 */
function classifyTier(signals: DeviceSignals): DeviceTier {
  const { deviceMemory, hardwareConcurrency } = signals
  // why: A withheld signal describes the browser, not the machine, so a device that reports incompletely is a middling one.
  if (deviceMemory === undefined || hardwareConcurrency === undefined) {
    return 'middle'
  }
  if (deviceMemory <= 2 || hardwareConcurrency <= 4) {
    return 'low'
  }
  return deviceMemory >= 8 && hardwareConcurrency >= 8 ? 'high' : 'middle'
}

/**
 * The shoal each band of frame size opens with, and the size it opens there.
 *
 * Read largest first: the first band a frame is at least as big as is the one
 * it opens in. The measure is the frame's own geometric mean, which is the edge
 * of the square that covers the same water, so a phone held either way up reads
 * the same and a short wide desktop window is not mistaken for a card.
 *
 * The counts are a presence judgement rather than a fit one. A pond scales its
 * koi to the water it was given, so the same shoal fits at every size; what
 * changes with the frame is how much of a crowd a visitor can take in at once,
 * and how much of a device's frame budget a demo may reasonably ask for.
 */
const OPENING_SHOAL: readonly { readonly atPx: number; readonly koi: number }[] = [
  { atPx: 1000, koi: 8 },
  { atPx: 640, koi: 5 },
  { atPx: 320, koi: 3 },
  { atPx: 0, koi: 1 },
]

/** The frame a pond stands in for its own when that reports nothing honest, in CSS pixels. */
// why: A container measured before layout reports zero on an axis, and reading that as a tiny screen would open a single koi on a desktop. The smallest swimmable pond is the stand-in the world derivation already falls back to, and it lands squarely in the middle band.
const UNMEASURED_FRAME = { width: 800, height: 600 }

/**
 * How many koi a frame of a given size opens with.
 *
 * @param width - The presenting frame's width in CSS pixels.
 * @param height - The presenting frame's height in CSS pixels.
 * @param cap - The most koi this device seats.
 * @returns The opening count, never past the cap and never below one.
 *
 * @example Opening the full scene
 * ```typescript
 * const count = openingShoal(root.clientWidth, root.clientHeight, device.cap)
 * ```
 */
export function openingShoal(width: number, height: number, cap: number): number {
  const frame = width > 0 && height > 0 ? { width, height } : UNMEASURED_FRAME
  const measured = Math.sqrt(frame.width * frame.height)
  const band = OPENING_SHOAL.find((step) => measured >= step.atPx)
  return Math.max(1, Math.min(band?.koi ?? 1, cap))
}

/**
 * Reads the device's tier and the shoal ceiling that follows from it.
 *
 * @param signals - What the browser reports about the hardware; the live `navigator` by default.
 * @returns The tier and the most koi it holds.
 *
 * @example Bounding the roster
 * ```typescript
 * const device = readDeviceProfile()
 * const roomForMore = shoal.length < device.cap
 * ```
 */
export function readDeviceProfile(signals: DeviceSignals = navigator): DeviceProfile {
  const tier = classifyTier(signals)
  return { tier, cap: SHOAL_CAP[tier] }
}
