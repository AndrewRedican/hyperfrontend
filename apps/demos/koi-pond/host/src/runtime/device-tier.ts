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
