import { describe, expect, it } from '@hyperfrontend/testing'
import { getTimeBasedPassword } from './node'

describe('getTimeBasedPassword (node)', () => {
  const baseTimeWindow = 1
  const referenceTime = new Date('2024-01-01T00:00:00Z')
  const s1 = 1000
  const s5 = s1 * 5
  const s30 = s1 * 30
  const m1 = s1 * 60

  const getPassword = (offset = 0) => getTimeBasedPassword(new Date(referenceTime.getTime() + offset), baseTimeWindow)

  it.each([s1, s5, s30, m1 - s1])('creates the reference password %i ms later, inside the same time window', async (offsetMs: number) => {
    const targetPassword = await getPassword()
    expect(await getPassword(offsetMs)).toEqual(targetPassword)
  })

  it.each([m1, m1 + s1, m1 + s5])('creates a different password %i ms later, once the time window has passed', async (offsetMs: number) => {
    const targetPassword = await getPassword()
    expect(await getPassword(offsetMs)).not.toEqual(targetPassword)
  })

  it.each([-2, 2])('throws error for the out-of-range window offset %i', async (windowOffset: number) => {
    const getPassword = (offset: number) =>
      getTimeBasedPassword(new Date(referenceTime.getTime()), baseTimeWindow, offset as unknown as -1 | 0 | 1)

    await expect(getPassword(windowOffset)).rejects.toThrow('Window offset must be -1, 0, or 1.')
  })
})
