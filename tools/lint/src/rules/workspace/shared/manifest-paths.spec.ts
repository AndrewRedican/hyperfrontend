import { describe, expect, it } from '@hyperfrontend/testing'
import { SOURCE_PREFIX, isRelativePath } from './manifest-paths.ts'

describe('isRelativePath', () => {
  it('accepts a path into the package', () => {
    expect(isRelativePath('./src/index.js')).toBe(true)
  })

  it('accepts a path out of the package', () => {
    expect(isRelativePath('../x.js')).toBe(true)
  })

  it('rejects a bare specifier', () => {
    expect(isRelativePath('src/index.js')).toBe(false)
  })
})

describe('SOURCE_PREFIX', () => {
  it('names the source directory relative to the package', () => {
    expect(SOURCE_PREFIX).toBe('./src/')
  })
})
