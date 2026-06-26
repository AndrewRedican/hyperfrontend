import { buildMarkerBlock, insertFeatureImport } from './insert-marker'

describe('buildMarkerBlock', () => {
  it('wraps the glue import in the managed marker comments', () => {
    expect(buildMarkerBlock('./hyperfrontend.feature')).toEqual(expect.stringContaining("import './hyperfrontend.feature'"))
  })
})

describe('insertFeatureImport', () => {
  it('prepends the marker block to an unmarked entry file', () => {
    expect(insertFeatureImport('const x = 1\n', './hyperfrontend.feature')).toEqual({
      content: expect.stringContaining('const x = 1'),
      changed: true,
    })
  })

  it('leaves an already-marked entry file untouched', () => {
    const source = '// <hf:feature>\nimport "./x"\n// </hf:feature>\nconst y = 2\n'
    expect(insertFeatureImport(source, './hyperfrontend.feature')).toEqual({ content: source, changed: false })
  })
})
