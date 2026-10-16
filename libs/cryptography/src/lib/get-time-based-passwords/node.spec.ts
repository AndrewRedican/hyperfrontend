import { describe, expect, it } from '@hyperfrontend/testing'
import { getTimeBasedPasswords } from './node'

describe('getTimeBasedPasswords (node)', () => {
  const baseTimeWindow = 1
  const currentUtcTime = new Date()

  it('generates a current time window password that differs from the previous one', async () => {
    const { current, previous } = getTimeBasedPasswords(currentUtcTime, baseTimeWindow)
    const currentPassword = await current()
    const previousPassword = await previous()
    expect(currentPassword).not.toBe(previousPassword)
  })

  it('generates a current time window password that differs from the next one', async () => {
    const { current, next } = getTimeBasedPasswords(currentUtcTime, baseTimeWindow)
    const currentPassword = await current()
    const nextPassword = await next()
    expect(currentPassword).not.toBe(nextPassword)
  })

  it('generates a previous time window password that differs from the next one', async () => {
    const { previous, next } = getTimeBasedPasswords(currentUtcTime, baseTimeWindow)
    const previousPassword = await previous()
    const nextPassword = await next()
    expect(previousPassword).not.toBe(nextPassword)
  })
})
