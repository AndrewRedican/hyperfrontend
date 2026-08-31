import { describe, expect, it } from '@hyperfrontend/testing'
import { currentPlatformMatches, currentPlatformTarget } from './platform-check'

describe('currentPlatformTarget', () => {
  it('returns `<process.platform>-<process.arch>`', () => {
    expect(currentPlatformTarget()).toBe(`${process.platform}-${process.arch}`)
  })

  it('reflects a stubbed platform / arch via Object.defineProperty', () => {
    const originalPlatform = process.platform
    const originalArch = process.arch
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    Object.defineProperty(process, 'arch', { value: 'arm64', configurable: true })
    try {
      expect(currentPlatformTarget()).toBe('darwin-arm64')
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
      Object.defineProperty(process, 'arch', { value: originalArch, configurable: true })
    }
  })
})

describe('currentPlatformMatches', () => {
  it('returns true when the current target appears in the declared list', () => {
    const target = currentPlatformTarget()
    expect(currentPlatformMatches([target as never])).toBe(true)
  })

  it('returns false on an empty declared-platform list', () => {
    expect(currentPlatformMatches([])).toBe(false)
  })

  it('returns false when the current target is not declared', () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    try {
      expect(currentPlatformMatches(['linux-x64', 'darwin-arm64'])).toBe(false)
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    }
  })

  it('matches the current target when listed alongside other platforms', () => {
    const target = currentPlatformTarget()
    expect(currentPlatformMatches(['linux-arm64', target as never, 'win32-x64'])).toBe(true)
  })
})
