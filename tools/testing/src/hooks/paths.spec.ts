import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { firstExistingFile, loadAliases, resolveAlias } from './paths'

const WORKSPACE_ROOT = process.env['HF_TEST_WORKSPACE_ROOT'] ?? process.cwd()

describe('loadAliases', () => {
  it('reads the exact aliases from tsconfig.base.json', () => {
    assert.equal(loadAliases(WORKSPACE_ROOT).exact.has('@hyperfrontend/testing'), true)
  })

  it('collects the wildcard aliases separately', () => {
    assert.equal(
      loadAliases(WORKSPACE_ROOT).wildcards.every((pattern) => !pattern.prefix.includes('*')),
      true
    )
  })

  it('orders wildcards so the longest prefix is tried first', () => {
    const lengths = loadAliases(WORKSPACE_ROOT).wildcards.map((pattern) => pattern.prefix.length)
    assert.deepEqual(
      lengths,
      [...lengths].sort((a, b) => b - a)
    )
  })
})

describe('firstExistingFile', () => {
  it('returns a path that already carries an extension', () => {
    const target = `${WORKSPACE_ROOT}/tools/testing/src/hooks/paths.ts`
    assert.equal(firstExistingFile(target), target)
  })

  it('appends a TypeScript extension to an extensionless path', () => {
    assert.equal(firstExistingFile(`${WORKSPACE_ROOT}/tools/testing/src/hooks/paths`), `${WORKSPACE_ROOT}/tools/testing/src/hooks/paths.ts`)
  })

  it('resolves a directory to its index module', () => {
    assert.equal(firstExistingFile(`${WORKSPACE_ROOT}/tools/testing/src`), `${WORKSPACE_ROOT}/tools/testing/src/index.ts`)
  })

  it('returns null when nothing matches', () => {
    assert.equal(firstExistingFile(`${WORKSPACE_ROOT}/tools/testing/src/hooks/absent`), null)
  })
})

describe('resolveAlias', () => {
  it('maps an exact workspace alias to its source file', () => {
    assert.equal(
      resolveAlias('@hyperfrontend/testing', loadAliases(WORKSPACE_ROOT), WORKSPACE_ROOT),
      `${WORKSPACE_ROOT}/tools/testing/src/index.ts`
    )
  })

  it('maps a wildcard alias through its subpath', () => {
    assert.equal(
      resolveAlias('@hyperfrontend/immutable-api-utils/built-in-copy/object', loadAliases(WORKSPACE_ROOT), WORKSPACE_ROOT),
      `${WORKSPACE_ROOT}/libs/utils/immutable-api/src/built-in-copy/object/index.ts`
    )
  })

  it('returns null for a specifier no alias covers', () => {
    assert.equal(resolveAlias('node:fs', loadAliases(WORKSPACE_ROOT), WORKSPACE_ROOT), null)
  })

  it('returns null when an exact alias points at a missing file', () => {
    const aliases = { exact: new Map([['@absent/pkg', ['libs/absent/src/index.ts']]]), wildcards: [] }
    assert.equal(resolveAlias('@absent/pkg', aliases, WORKSPACE_ROOT), null)
  })

  it('returns null when a wildcard alias points at a missing file', () => {
    const aliases = { exact: new Map<string, string[]>(), wildcards: [{ prefix: '@absent/', targets: ['libs/absent/*.ts'] }] }
    assert.equal(resolveAlias('@absent/thing', aliases, WORKSPACE_ROOT), null)
  })
})
