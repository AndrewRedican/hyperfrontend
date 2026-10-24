import { afterEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { currentPlatformMatches, currentPlatformTarget } from './platform-check'

afterEach(() => jest.restoreAllMocks())

describe('currentPlatformTarget', () => {
  it('returns `<process.platform>-<process.arch>`', () => {
    expect(currentPlatformTarget()).toBe(`${process.platform}-${process.arch}`)
  })

  it('reflects a replaced platform and arch', () => {
    jest.replaceProperty(process, 'platform', 'darwin')
    jest.replaceProperty(process, 'arch', 'arm64')
    expect(currentPlatformTarget()).toBe('darwin-arm64')
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
    jest.replaceProperty(process, 'platform', 'win32')
    expect(currentPlatformMatches(['linux-x64', 'darwin-arm64'])).toBe(false)
  })

  it('matches the current target when listed alongside other platforms', () => {
    const target = currentPlatformTarget()
    expect(currentPlatformMatches(['linux-arm64', target as never, 'win32-x64'])).toBe(true)
  })
})
