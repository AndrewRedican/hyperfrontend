import { describe, expect, it } from '@hyperfrontend/testing'
import { isMarker } from './is-marker'

describe('isMarker', () => {
  it('returns true when text matches the expected format', () => {
    expect(isMarker('__$96184805415709618480541570')).toEqual(true)
  })

  it.each([['__96184805415709618480541570'], ['_$96184805415709618480541570'], ['not-a-marker'], [''], [null]])(
    'returns false when text %p does not match the expected format',
    (text: string) => {
      expect(isMarker(text)).toEqual(false)
    }
  )
})
