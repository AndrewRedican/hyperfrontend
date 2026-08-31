import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { discoverScopes } from './scope-discovery'

const fixturesRoot = resolve(import.meta.dirname, '../../../../__fixtures__/scope-discovery')

describe('discoverScopes', () => {
  it('returns empty when no paths are staged', () => {
    expect(discoverScopes([], { cwd: fixturesRoot })).toEqual([])
  })

  it('resolves a staged file to its owning project.json name', () => {
    expect(discoverScopes(['alpha/src/index.ts'], { cwd: fixturesRoot })).toEqual([{ name: 'alpha', path: `${fixturesRoot}/alpha` }])
  })

  it('deduplicates paths that map to the same project root', () => {
    expect(discoverScopes(['alpha/src/index.ts', 'alpha/src/index.ts'], { cwd: fixturesRoot }).map((entry) => entry.name)).toEqual([
      'alpha',
    ])
  })

  it('unions scopes across multiple projects', () => {
    expect(discoverScopes(['alpha/src/index.ts', 'beta/src/index.ts'], { cwd: fixturesRoot }).map((entry) => entry.name)).toEqual([
      'alpha',
      'beta',
    ])
  })

  it('falls back to package.json when project.json is absent', () => {
    expect(discoverScopes(['nested/src/index.ts'], { cwd: fixturesRoot }).map((entry) => entry.name)).toEqual(['nested-pkg'])
  })

  it('drops paths inside node_modules', () => {
    expect(discoverScopes(['node_modules/dep/file.ts'], { cwd: fixturesRoot })).toEqual([])
  })

  it('drops paths inside .git', () => {
    expect(discoverScopes(['.git/HEAD'], { cwd: fixturesRoot })).toEqual([])
  })

  it('applies the consumer-provided scopeFilter', () => {
    expect(
      discoverScopes(['alpha/src/index.ts', 'beta/src/index.ts'], {
        cwd: fixturesRoot,
        scopeFilter: ({ name }) => name !== 'beta',
      }).map((entry) => entry.name)
    ).toEqual(['alpha'])
  })

  it('accepts absolute staged paths', () => {
    expect(discoverScopes([`${fixturesRoot}/alpha/src/index.ts`], { cwd: '/unused' })).toEqual([
      { name: 'alpha', path: `${fixturesRoot}/alpha` },
    ])
  })
})
