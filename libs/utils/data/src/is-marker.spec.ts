import { isMarker } from './is-marker'

describe('isMarker', () => {
  it('returns true when text matches the expected format', () => {
    expect(isMarker('__$96184805415709618480541570')).toEqual(true)
  })

  it('returns false when text does not match the expected format', () => {
    expect(isMarker('__96184805415709618480541570')).toEqual(false)
    expect(isMarker('_$96184805415709618480541570')).toEqual(false)
    expect(isMarker('not-a-marker')).toEqual(false)
    expect(isMarker('')).toEqual(false)
    expect(isMarker(null)).toEqual(false)
  })
})
