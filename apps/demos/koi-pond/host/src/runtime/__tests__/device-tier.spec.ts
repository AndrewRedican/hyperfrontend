import type { DeviceSignals } from '../device-tier'
import { describe, expect, it } from 'vitest'
import { readDeviceProfile } from '../device-tier'

/**
 * The tier a device reporting these signals lands in.
 *
 * @param signals - What the browser reports about the hardware.
 * @returns The tier name alone, for the cases that are about classification rather than the cap.
 */
function tierOf(signals: DeviceSignals) {
  return readDeviceProfile(signals).tier
}

describe('classification', () => {
  it('reads a device at both low boundaries as low', () => {
    expect(tierOf({ deviceMemory: 2, hardwareConcurrency: 4 })).toBe('low')
  })

  it('reads a device at both high boundaries as high', () => {
    expect(tierOf({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe('high')
  })

  it('holds a device short of the memory the high tier asks for at middle', () => {
    expect(tierOf({ deviceMemory: 6, hardwareConcurrency: 8 })).toBe('middle')
  })

  it('holds a device short of the cores the high tier asks for at middle', () => {
    expect(tierOf({ deviceMemory: 8, hardwareConcurrency: 6 })).toBe('middle')
  })

  it('lets scarce memory alone decide a device is low', () => {
    expect(tierOf({ deviceMemory: 2, hardwareConcurrency: 16 })).toBe('low')
  })

  it('lets a thin core count alone decide a device is low', () => {
    expect(tierOf({ deviceMemory: 16, hardwareConcurrency: 4 })).toBe('low')
  })

  it('reads a device just past both low boundaries as middle', () => {
    expect(tierOf({ deviceMemory: 3, hardwareConcurrency: 5 })).toBe('middle')
  })

  it('reads a device well past both high boundaries as high', () => {
    expect(tierOf({ deviceMemory: 16, hardwareConcurrency: 16 })).toBe('high')
  })
})

describe('a device that withholds a signal', () => {
  it('is middle when it reports no memory, however many cores it has', () => {
    expect(tierOf({ hardwareConcurrency: 16 })).toBe('middle')
  })

  it('is middle when it reports no memory, however few cores it has', () => {
    expect(tierOf({ hardwareConcurrency: 2 })).toBe('middle')
  })

  it('is middle when it reports no cores, however much memory it has', () => {
    expect(tierOf({ deviceMemory: 16 })).toBe('middle')
  })

  it('is middle when it reports no cores, however little memory it has', () => {
    expect(tierOf({ deviceMemory: 2 })).toBe('middle')
  })

  it('is middle when it reports nothing at all', () => {
    expect(tierOf({})).toBe('middle')
  })
})

describe('the shoal cap', () => {
  it('seats four koi on a low device', () => {
    expect(readDeviceProfile({ deviceMemory: 2, hardwareConcurrency: 4 })).toEqual({ tier: 'low', cap: 4 })
  })

  it('seats eight koi on a middle device', () => {
    expect(readDeviceProfile({ deviceMemory: 6, hardwareConcurrency: 8 })).toEqual({ tier: 'middle', cap: 8 })
  })

  it('seats twelve koi on a high device, the only tier with room for a twin', () => {
    expect(readDeviceProfile({ deviceMemory: 8, hardwareConcurrency: 8 })).toEqual({ tier: 'high', cap: 12 })
  })
})

describe('the live device', () => {
  it('reads the browser itself when handed no signals', () => {
    // why: The test environment withholds deviceMemory exactly as Safari and Firefox do, which is the unknown-means-middle path.
    expect(readDeviceProfile()).toEqual({ tier: 'middle', cap: 8 })
  })
})
