import { describe, expect, it } from '@hyperfrontend/testing'
import { validateExternalsConfig } from './validate-globals'

describe('validateExternalsConfig', () => {
  it('passes when external is undefined', () => {
    expect(() => validateExternalsConfig(undefined, undefined)).not.toThrow()
  })

  it('passes when external is empty', () => {
    expect(() => validateExternalsConfig([], undefined)).not.toThrow()
  })

  it('passes when every external dependency has a globals mapping', () => {
    expect(() => validateExternalsConfig(['react'], { react: 'React' })).not.toThrow()
  })

  it('throws an aggregated error listing every missing globals entry', () => {
    expect(() => validateExternalsConfig(['react', 'lodash'], { react: 'React' })).toThrow(/lodash/)
  })

  it('throws when globals is undefined and external is non-empty', () => {
    expect(() => validateExternalsConfig(['react'], undefined)).toThrow(/Missing globals mapping/)
  })
})
