import { describe, expect, it } from '@hyperfrontend/testing'
import { ALIAS_TSCONFIG, createAliasWorkspace } from '../__test-utils__/alias-workspace'
import { workspaceGraph } from '../build'
import { aliasImporters, aliasResolving, changedAliases } from './aliases'

const { paths } = ALIAS_TSCONFIG.compilerOptions

describe('changedAliases', () => {
  it.each([
    ['an alias added', { ...paths, '@fixture/data/json': ['libs/data/src/json/index.ts'] }, ['@fixture/data/json']],
    ['an alias removed', { '@fixture/data': paths['@fixture/data'] }, ['@fixture/data/csv', '@fixture/kit', '@fixture/report']],
    ['an alias pointed elsewhere', { ...paths, '@fixture/kit': ['libs/kit/src/main.ts'] }, ['@fixture/kit']],
    ['the aliases in another order', { '@fixture/report': paths['@fixture/report'], ...paths }, []],
  ])('names %s', (_title, head, expected) => {
    expect(changedAliases(ALIAS_TSCONFIG, { compilerOptions: { strict: true, paths: head } })).toEqual(expected)
  })

  it('names every alias of a file that gains its paths', () => {
    expect(changedAliases({}, { compilerOptions: { paths: { '@fixture/data': ['libs/data/src/index.ts'] } } })).toEqual(['@fixture/data'])
  })

  it('names every alias of a file that loses its paths', () => {
    expect(changedAliases({ compilerOptions: { paths: { '@fixture/data': ['libs/data/src/index.ts'] } } }, {})).toEqual(['@fixture/data'])
  })

  it.each([
    ['a compiler option', { compilerOptions: { strict: false, paths } }],
    ['a field beside the compiler options', { compilerOptions: { strict: true, paths }, exclude: ['dist'] }],
  ])('names nothing when %s differs', (_title, head) => {
    expect(changedAliases(ALIAS_TSCONFIG, head)).toBeNull()
  })
})

describe('aliasResolving', () => {
  it.each([
    [['@fixture/data/csv'], '@fixture/data/csv', '@fixture/data/csv'],
    [['@fixture/data/csv'], '@fixture/data', null],
    [['@fixture/data/csv'], '@fixture/data/csv/read', null],
    [['@fixture/kit', '@fixture/data/*'], '@fixture/data/json', '@fixture/data/*'],
    [[], '@fixture/data', null],
  ])('finds among %j the alias resolving %s', (aliases, specifier, expected) => {
    expect(aliasResolving(aliases, specifier)).toBe(expected)
  })
})

describe('aliasImporters', () => {
  const graph = workspaceGraph(createAliasWorkspace())

  it('lists the files importing through a changed alias, sorted, each with its import', () => {
    expect([...aliasImporters(graph, ['@fixture/data/csv'])]).toEqual([
      ['libs/kit/src/index.ts', { alias: '@fixture/data/csv', specifier: '@fixture/data/csv' }],
      ['libs/report/src/index.ts', { alias: '@fixture/data/csv', specifier: '@fixture/data/csv' }],
    ])
  })

  it('lists a file once, by its first import through a changed alias', () => {
    expect([...aliasImporters(graph, ['@fixture/report', '@fixture/data'])]).toEqual([
      ['libs/plain/src/index.ts', { alias: '@fixture/data', specifier: '@fixture/data' }],
      ['libs/site/src/index.ts', { alias: '@fixture/report', specifier: '@fixture/report' }],
    ])
  })

  it('lists nothing when no alias changed', () => {
    expect([...aliasImporters(graph, [])]).toEqual([])
  })
})
