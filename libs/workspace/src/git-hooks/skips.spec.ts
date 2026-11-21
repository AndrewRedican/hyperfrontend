import type { SkipSources } from './skips'
import { describe, expect, it } from '@hyperfrontend/testing'
import { namesOf, skipReason, unknownSkips } from './skips'

/**
 * Sources that skip nothing, with what a case changes.
 *
 * @param changes - The flags, variables or preferences of the case
 * @returns What can keep a step from running in the case
 */
function sources(changes: Partial<SkipSources> = {}): SkipSources {
  return { env: {}, local: {}, only: [], skip: [], ...changes }
}

describe('namesOf', () => {
  it('reads the names between commas, without the space around them', () => {
    expect(namesOf(' pipeline, audit ,,')).toEqual(['pipeline', 'audit'])
  })

  it('reads no name from a variable that is not set', () => {
    expect(namesOf(undefined)).toEqual([])
  })
})

describe('skipReason', () => {
  it('runs a step nothing names', () => {
    expect(skipReason('pre-push', 'audit', sources())).toBeNull()
  })

  it('skips every step when the hooks are switched off', () => {
    expect(skipReason('pre-push', 'audit', sources({ env: { HF_HOOKS: '0' } }))).toBe('HF_HOOKS=0')
  })

  it('runs the steps when the variable holds anything else', () => {
    expect(skipReason('pre-push', 'audit', sources({ env: { HF_HOOKS: '1' } }))).toBeNull()
  })

  it('skips a step --only leaves out', () => {
    expect(skipReason('pre-push', 'audit', sources({ only: ['pipeline'] }))).toBe('--only')
  })

  it('runs a step --only names', () => {
    expect(skipReason('pre-push', 'audit', sources({ only: ['audit'] }))).toBeNull()
  })

  it('skips a step --skip names', () => {
    expect(skipReason('pre-push', 'audit', sources({ skip: ['audit'] }))).toBe('--skip')
  })

  it('skips a step the environment names', () => {
    expect(skipReason('pre-push', 'audit', sources({ env: { HF_HOOKS_SKIP: 'pipeline,audit' } }))).toBe('HF_HOOKS_SKIP')
  })

  it('skips a step the local file names', () => {
    expect(skipReason('pre-push', 'audit', sources({ local: { skip: ['audit'] } }))).toBe('hooks.local.config.ts')
  })

  it('skips a step named with its hook', () => {
    expect(skipReason('pre-push', 'audit', sources({ local: { skip: ['pre-push:audit'] } }))).toBe('hooks.local.config.ts')
  })

  it('runs a step named with another hook', () => {
    expect(skipReason('pre-push', 'audit', sources({ local: { skip: ['pre-commit:audit'] } }))).toBeNull()
  })
})

describe('unknownSkips', () => {
  const config = { 'pre-push': [{ name: 'pipeline', run: ['hf', 'affected', '-t', 'test'] }] }

  it('says nothing when every name is a step', () => {
    expect(unknownSkips(config, sources({ only: ['pipeline'], skip: ['pre-push:pipeline'], local: { skip: ['pipeline'] } }))).toEqual([])
  })

  it('names what each source misspelt', () => {
    expect(
      unknownSkips(config, sources({ only: ['a'], skip: ['b'], env: { HF_HOOKS_SKIP: 'c,pipeline' }, local: { skip: ['d', 'e'] } }))
    ).toEqual([
      '--only names no step: a',
      '--skip names no step: b',
      'HF_HOOKS_SKIP names no step: c',
      'hooks.local.config.ts names no step: d, e',
    ])
  })
})
