import type { NxRunner } from './capture'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { affectedTasks, captureBaseline, parseAffectedProjects, parseExplanation } from './capture'

const EXPLANATION = {
  affected: {
    'lib-logging:build': [{ kind: 'input-file', file: 'libs/logging/src/index.ts', pattern: 'libs/logging/**/*' }],
    'lib-features:build': [{ kind: 'input-file', file: 'libs/logging/src/index.ts', pattern: 'libs/logging/**/*' }],
    'lib-logging:test': [{ kind: 'input-file', file: 'libs/logging/src/index.ts', pattern: 'libs/logging/**/*' }],
    'lib-logging:version:check': [],
  },
  upstream: { 'lib-logging:install': [{ kind: 'dependent-output', producer: 'lib-logging:build' }] },
  touched: ['lib-logging:build'],
  requested: { targets: ['build', 'test'], total: 68 },
}

describe('parseAffectedProjects', () => {
  it('sorts the names Nx printed', () => {
    expect(parseAffectedProjects('["lib-logging","e2e-lib-logging","docs-site"]\n')).toEqual([
      'docs-site',
      'e2e-lib-logging',
      'lib-logging',
    ])
  })

  it('rejects output that is not a list', () => {
    expect(() => parseAffectedProjects('{"projects":[]}')).toThrow('did not print a list of project names')
  })

  it('rejects a list holding anything but names', () => {
    expect(() => parseAffectedProjects('["lib-logging", 1]')).toThrow('did not print a list of project names')
  })
})

describe('parseExplanation', () => {
  it('returns the explanation as Nx wrote it', () => {
    expect(parseExplanation(stringify(EXPLANATION))).toEqual(EXPLANATION)
  })

  it('rejects output that is not an object', () => {
    expect(() => parseExplanation('["lib-logging:build"]')).toThrow('did not print an explanation object')
  })

  it('rejects null', () => {
    expect(() => parseExplanation('null')).toThrow('did not print an explanation object')
  })

  it('names the keys an explanation lacks', () => {
    expect(() => parseExplanation('{"affected":{},"touched":[]}')).toThrow('without upstream, requested')
  })
})

describe('affectedTasks', () => {
  it('lists the tasks of one target, sorted', () => {
    expect(affectedTasks(EXPLANATION, 'build')).toEqual(['lib-features:build', 'lib-logging:build'])
  })

  it('matches a target name that itself carries a colon', () => {
    expect(affectedTasks(EXPLANATION, 'version:check')).toEqual(['lib-logging:version:check'])
  })
})

describe('captureBaseline', () => {
  const run = jest.fn<Parameters<NxRunner>, string>((args) => (args[0] === 'show' ? '["lib-b","lib-a"]' : stringify(EXPLANATION)))

  it('asks Nx for the projects and the task explanation over the same range', () => {
    run.mockClear()
    captureBaseline({ base: 'abc', head: 'def', targets: ['build', 'test'], run })
    expect(run.mock.calls).toEqual([
      [['show', 'projects', '--affected', '--json', '--base=abc', '--head=def']],
      [['affected', '-t', 'build,test', '--explain=stdout', '--base=abc', '--head=def']],
    ])
  })

  it('returns the range with the sorted projects and the explanation', () => {
    expect(captureBaseline({ base: 'abc', head: 'def', targets: ['build'], run })).toEqual({
      base: 'abc',
      head: 'def',
      projects: ['lib-a', 'lib-b'],
      explanation: EXPLANATION,
    })
  })
})
