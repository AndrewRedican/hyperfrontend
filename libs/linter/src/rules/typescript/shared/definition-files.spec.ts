import { describe, expect, it } from '@hyperfrontend/testing'
import { isDefinitionFile } from './definition-files'

describe('isDefinitionFile', () => {
  it('accepts a .d.ts file', () => {
    expect(isDefinitionFile('/w/types.d.ts')).toBe(true)
  })

  it('accepts a .d.mts file in any letter case', () => {
    expect(isDefinitionFile('/w/TYPES.D.MTS')).toBe(true)
  })

  it('accepts a .d.cts file', () => {
    expect(isDefinitionFile('/w/types.d.cts')).toBe(true)
  })

  it('accepts a .d. segment before another extension', () => {
    expect(isDefinitionFile('/w/shims.d.vue.ts')).toBe(true)
  })

  it('rejects a source file', () => {
    expect(isDefinitionFile('/w/index.ts')).toBe(false)
  })

  it('rejects a .d.tsx file', () => {
    expect(isDefinitionFile('/w/types.d.tsx')).toBe(false)
  })
})
