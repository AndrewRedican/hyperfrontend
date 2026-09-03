import { describe, expect, it } from '@hyperfrontend/testing'
import { getTimeBasedPassword } from './browser'

describe('getTimeBasedPassword (browser)', () => {
  const baseTimeWindow = 1
  const referenceTime = new Date('2024-01-01T00:00:00Z')
  const s1 = 1000
  const s5 = s1 * 5
  const s30 = s1 * 30
  const m1 = s1 * 60

  const getPassword = (offset = 0) => getTimeBasedPassword(new Date(referenceTime.getTime() + offset), baseTimeWindow)

  it('creates a consistent password dependent on time', async () => {
    const targetPassword = await getPassword()

    const isEqual = async (offsetMs: number) => expect(await getPassword(offsetMs)).toEqual(targetPassword)
    const notEqual = async (offsetMs: number) => expect(await getPassword(offsetMs)).not.toEqual(targetPassword)

    await isEqual(s1)
    await isEqual(s5)
    await isEqual(s30)
    await isEqual(m1 - s1)
    await notEqual(m1)
    await notEqual(m1 + s1)
    await notEqual(m1 + s5)
  })

  it('throws error for invalid number range', async () => {
    const getPassword = (windowOffset: number) =>
      getTimeBasedPassword(new Date(referenceTime.getTime()), baseTimeWindow, windowOffset as unknown as -1 | 0 | 1)

    await expect(getPassword(-2)).rejects.toThrow('Window offset must be -1, 0, or 1.')
    await expect(getPassword(2)).rejects.toThrow('Window offset must be -1, 0, or 1.')
  })
})
