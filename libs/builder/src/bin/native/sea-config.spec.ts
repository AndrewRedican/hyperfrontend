import { describe, expect, it } from '@hyperfrontend/testing'
import { generateSeaConfig } from './sea-config'

describe('generateSeaConfig', () => {
  it('returns a document with main, output, and disableExperimentalSEAWarning', () => {
    const doc = generateSeaConfig({
      mainPath: '/abs/dist/libs/builder/bin/hf-build.cjs.js',
      outputPath: '/abs/dist/libs/builder/bin/hf-build.sea-prep.blob',
    })
    expect(doc).toEqual({
      main: '/abs/dist/libs/builder/bin/hf-build.cjs.js',
      output: '/abs/dist/libs/builder/bin/hf-build.sea-prep.blob',
      disableExperimentalSEAWarning: true,
    })
  })

  it('always sets disableExperimentalSEAWarning to true', () => {
    const doc = generateSeaConfig({ mainPath: '/m', outputPath: '/o' })
    expect(doc.disableExperimentalSEAWarning).toBe(true)
  })

  it('preserves the supplied paths verbatim (no normalization)', () => {
    const doc = generateSeaConfig({ mainPath: '/a/./b/../c', outputPath: '/x/./y' })
    expect(doc.main).toBe('/a/./b/../c')
    expect(doc.output).toBe('/x/./y')
  })
})
