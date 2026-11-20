import { describe, expect, it } from '@hyperfrontend/testing'
import { environmentOf } from './model'

describe('environmentOf', () => {
  it.each([
    ['win32', 'windows'],
    ['darwin', 'macos'],
    ['linux', 'linux'],
    ['freebsd', 'linux'],
  ])('reads %s as %s', (platform, environment) => {
    expect(environmentOf(platform)).toBe(environment)
  })
})
