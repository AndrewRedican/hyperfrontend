import type { SessionConfig } from '../models/session-config'
import { resolve } from 'node:path'
import { conventionalPreset } from '../../validate/presets/conventional'
import { DEFAULT_IMPERATIVE_WORDLIST } from '../../validate/rules/imperative-mood'
import { createSessionContext } from '../models/session-context'
import { StepStatus } from '../models/step'
import { EMPTY_STAGING_MESSAGE, resolveScopeStep } from './resolve-scope'

const fixturesRoot = resolve(__dirname, '../../../../__fixtures__/scope-discovery')

function configWith(stagedPaths: readonly string[]): SessionConfig {
  return {
    types: [{ name: 'feat' }],
    scopeOptional: false,
    scopeMulti: false,
    stagedPathsProvider: () => stagedPaths,
    cwd: fixturesRoot,
    headerMaxLength: 72,
    imperativeWordlist: DEFAULT_IMPERATIVE_WORDLIST,
    skipCommit: true,
    validateRuleset: conventionalPreset,
  }
}

describe('resolveScopeStep', () => {
  it('cancels with the empty-staging error when nothing is staged', async () => {
    const ctx = createSessionContext(configWith([]))
    const result = await resolveScopeStep.run(ctx)
    expect(result).toEqual(expect.objectContaining({ status: StepStatus.Cancelled }))
    expect(result.error?.message).toBe(EMPTY_STAGING_MESSAGE)
  })

  it('populates candidateScopes from discovered projects', async () => {
    const ctx = createSessionContext(configWith(['alpha/src/index.ts', 'beta/src/index.ts']))
    await resolveScopeStep.run(ctx)
    expect(ctx.candidateScopes).toEqual(['alpha', 'beta'])
  })

  it('picks the single owner as the default scope', async () => {
    const ctx = createSessionContext(configWith(['alpha/src/index.ts']))
    await resolveScopeStep.run(ctx)
    expect(ctx.defaultScope).toBe('alpha')
  })

  it('returns done when scopes resolve', async () => {
    const ctx = createSessionContext(configWith(['alpha/src/index.ts']))
    const result = await resolveScopeStep.run(ctx)
    expect(result).toEqual({ status: StepStatus.Done })
  })
})
