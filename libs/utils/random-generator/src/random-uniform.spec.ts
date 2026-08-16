import { randomUniform } from './random-uniform'

// why: An unseeded source put this mean within three standard errors of its tolerance, so roughly three runs in a thousand failed; a fixed stream makes the sample exactly reproducible.
jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/math', () => {
  const actual = jest.requireActual('@hyperfrontend/immutable-api-utils/built-in-copy/math')
  let seed = 1
  return {
    ...actual,
    random: () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    },
  }
})

describe('randomUniform', () => {
  it('generates numbers following a uniform distribution', () => {
    const min = 2
    const max = 8
    const sampleSize = 10000
    let sum = 0

    for (let i = 0; i < sampleSize; i++) {
      const num = randomUniform(min, max)
      sum += num
    }

    const calculatedMean = sum / sampleSize

    expect(calculatedMean).toBeCloseTo((min + max) / 2, 1)
  })
})
