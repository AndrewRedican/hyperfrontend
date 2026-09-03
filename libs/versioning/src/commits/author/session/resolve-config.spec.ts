import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { conventionalPreset as conventionalRuleset } from '../../validate/presets/conventional'
import { DEFAULT_IMPERATIVE_WORDLIST } from '../../validate/rules/imperative-mood'
import { DEFAULT_SESSION_TYPES, resolveSessionConfig } from './resolve-config'

describe('resolveSessionConfig', () => {
  it('applies the built-in defaults when nothing is supplied', () => {
    expect(resolveSessionConfig()).toEqual({
      types: DEFAULT_SESSION_TYPES,
      scopeOptional: false,
      scopeMulti: false,
      stagedPathsProvider: expect.any(Function),
      cwd: expect.any(String),
      headerMaxLength: 72,
      imperativeWordlist: DEFAULT_IMPERATIVE_WORDLIST,
      skipCommit: false,
      validateRuleset: conventionalRuleset,
    })
  })

  it('keeps caller-supplied overrides on top of defaults', () => {
    const scopeFilter = () => true
    const commitExecutor = jest.fn<void, [string]>()
    const stagedPathsProvider = () => ['file.ts']

    const resolved = resolveSessionConfig({
      scopeFilter,
      scopeMulti: true,
      scopeOptional: true,
      stagedPathsProvider,
      cwd: '/repo',
      headerMaxLength: null,
      skipCommit: true,
      commitExecutor,
    })

    expect(resolved).toEqual(
      expect.objectContaining({
        scopeFilter,
        scopeMulti: true,
        scopeOptional: true,
        stagedPathsProvider,
        cwd: '/repo',
        headerMaxLength: null,
        skipCommit: true,
        commitExecutor,
      })
    )
  })

  it('exposes the conventional type hints on the default type list', () => {
    expect(DEFAULT_SESSION_TYPES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'feat', description: 'A new feature' }),
        expect.objectContaining({ name: 'fix', description: 'A bug fix' }),
      ])
    )
  })
})
