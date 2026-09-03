import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it } from '@hyperfrontend/testing'
import { synthesizeMissingNamedExports } from './missing-exports'

const WRAPPER = [
  'function requireApi() {',
  '  return { inject: () => 1 };',
  '}',
  'var apiExports = requireApi();',
  'const api = /*@__PURE__*/getDefaultExportFromCjs(apiExports);',
  'export { api as default };',
].join('\n')

const demandOf = (...names: string[]): Set<string> => createSet(names)

describe('synthesizeMissingNamedExports', () => {
  it('returns null when nothing is demanded', () => {
    expect(synthesizeMissingNamedExports(WRAPPER, demandOf())).toBeNull()
  })

  it('returns null when every demanded name is already exported', () => {
    expect(synthesizeMissingNamedExports('const inject = 1;\nexport { inject };', demandOf('inject'))).toBeNull()
  })

  it('synthesizes a missing name from the interop default', () => {
    expect(synthesizeMissingNamedExports(WRAPPER, demandOf('extract'))).toEqual({
      code: `${WRAPPER}\nconst extract = api.extract;\nexport { extract };\n`,
      synthesizedNames: ['extract'],
    })
  })

  it('aliases the synthesized local when the name already appears in the chunk', () => {
    expect(synthesizeMissingNamedExports(WRAPPER, demandOf('inject'))).toEqual({
      code: expect.stringContaining('const inject$1 = api.inject;\nexport { inject$1 as inject };'),
      synthesizedNames: ['inject'],
    })
  })

  it('increments the alias suffix past an existing collision', () => {
    const source = `const inject$1 = 0;\nuse(inject$1, inject);\n${WRAPPER}`
    expect(synthesizeMissingNamedExports(source, demandOf('inject'))).toEqual({
      code: expect.stringContaining('const inject$2 = api.inject;\nexport { inject$2 as inject };'),
      synthesizedNames: ['inject'],
    })
  })

  it('synthesizes multiple names in sorted order', () => {
    expect(synthesizeMissingNamedExports(WRAPPER, demandOf('zeta', 'alpha'))).toEqual({
      code: expect.stringContaining('const alpha = api.alpha;\nconst zeta = api.zeta;\nexport { alpha, zeta };'),
      synthesizedNames: ['alpha', 'zeta'],
    })
  })

  it('appends a separating newline when the source does not end with one', () => {
    expect(synthesizeMissingNamedExports(WRAPPER.trimEnd(), demandOf('extract'))).toEqual({
      code: expect.stringContaining('export { api as default };\nconst extract = api.extract;'),
      synthesizedNames: ['extract'],
    })
  })

  it('returns null when the chunk has no default export', () => {
    expect(synthesizeMissingNamedExports('const a = 1;\nexport { a };', demandOf('missing'))).toBeNull()
  })

  it('returns null when the default is not a commonjs interop object', () => {
    expect(synthesizeMissingNamedExports('const api = { real: 1 };\nexport { api as default };', demandOf('missing'))).toBeNull()
  })

  it('returns null when the default local resolves through a plain identifier', () => {
    expect(
      synthesizeMissingNamedExports('var apiExports = requireApi();\nconst api = apiExports;\nexport { api as default };', demandOf('x'))
    ).toBeNull()
  })

  it('returns null when the default local has no initializer', () => {
    expect(synthesizeMissingNamedExports('var api;\nexport { api as default };', demandOf('x'))).toBeNull()
  })

  it('never synthesizes the default name itself or non-identifier names', () => {
    expect(synthesizeMissingNamedExports(WRAPPER, demandOf('default', 'a-b'))).toBeNull()
  })
})
