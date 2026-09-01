/** @jest-environment jsdom */
import { describe, expect, it } from '@hyperfrontend/testing'
import { getTimeBasedPasswords } from './browser'

describe('getTimeBasedPasswords (browser)', () => {
  const baseTimeWindow = 1
  const currentUtcTime = new Date()

  it('generates different passwords for current, previous, and next time windows', async () => {
    const { current, previous, next } = getTimeBasedPasswords(currentUtcTime, baseTimeWindow)
    const currentPassword = await current()
    const previousPassword = await previous()
    const nextPassword = await next()
    expect(currentPassword).not.toBe(previousPassword)
    expect(currentPassword).not.toBe(nextPassword)
    expect(previousPassword).not.toBe(nextPassword)
  })
})
