import { describe, expect, it } from '@hyperfrontend/testing'
import { noop } from './noop-function'

describe('noop', () => {
  it.each([
    ['no arguments', []],
    ['mixed arguments', [1, 'a', true, {}, [], () => void 0]],
  ])('does not throw an error for %s', (_label: string, args: unknown[]) => {
    expect(() => noop(...args)).not.toThrow()
  })
})
