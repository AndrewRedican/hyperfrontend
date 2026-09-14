import { describe, expect, it } from '@hyperfrontend/testing'
import { readMoments } from './moments'

describe('readMoments', () => {
  it('reads a single offset', () => {
    expect(readMoments('1200', 10_000)).toEqual([1_200])
  })

  it('reads a comma-separated list in the order written, spaces allowed', () => {
    expect(readMoments('7400, 1200 ,0', 10_000)).toEqual([7_400, 1_200, 0])
  })

  it('drops a token that is not a number', () => {
    expect(readMoments('100,end,200', 10_000)).toEqual([100, 200])
  })

  it('spreads N moments evenly and ends on the last frame', () => {
    expect(readMoments('every:4', 10_000)).toEqual([2_500, 5_000, 7_500, 10_000])
  })

  it('rounds a spread that does not divide evenly', () => {
    expect(readMoments('every:3', 1_000)).toEqual([333, 667, 1_000])
  })

  it('rejects a spread of nothing', () => {
    expect(() => readMoments('every:0', 1_000)).toThrow('--at every:N needs a count of one or more')
  })

  it('rejects a spread that is not a count', () => {
    expect(() => readMoments('every:lots', 1_000)).toThrow('--at every:N needs a count of one or more')
  })

  it('rejects a list with no offsets in it', () => {
    expect(() => readMoments('start,end', 1_000)).toThrow('--at needs one or more millisecond offsets, comma separated, or every:N')
  })
})
