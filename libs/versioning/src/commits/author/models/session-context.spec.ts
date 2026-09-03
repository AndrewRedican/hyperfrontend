import type { SessionConfig } from './session-config'
import { describe, expect, it } from '@hyperfrontend/testing'
import { conventionalPreset } from '../../validate/presets/conventional'
import { DEFAULT_IMPERATIVE_WORDLIST } from '../../validate/rules/imperative-mood'
import { createSessionContext } from './session-context'

function baseConfig(): SessionConfig {
  return {
    types: [{ name: 'feat' }],
    scopeOptional: false,
    scopeMulti: false,
    stagedPathsProvider: () => [],
    cwd: '/tmp',
    headerMaxLength: 72,
    imperativeWordlist: DEFAULT_IMPERATIVE_WORDLIST,
    skipCommit: true,
    validateRuleset: conventionalPreset,
  }
}

describe('createSessionContext', () => {
  it('seeds an empty draft and empty scope candidates', () => {
    expect(createSessionContext(baseConfig())).toEqual({
      draft: {},
      candidateScopes: [],
      defaultScope: undefined,
      config: expect.objectContaining({ cwd: '/tmp' }),
    })
  })
})
