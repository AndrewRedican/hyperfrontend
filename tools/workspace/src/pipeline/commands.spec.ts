import { describe, expect, it } from '@hyperfrontend/testing'
import { declaredFloor, majorOf, nodeCommand, PROBE_SCRIPT, targetRank, taskCommand } from './commands'

describe('taskCommand', () => {
  it('runs one target of a project through the owned single-task entry, with the alias hook', () => {
    expect(taskCommand('lib-a:build')).toEqual([
      'node',
      '--import',
      './tools/lint/src/runtime/aliases.ts',
      'tools/workspace/bin/hf.ts',
      'run',
      'lib-a:build',
    ])
  })
})

describe('nodeCommand', () => {
  it('runs the script on the workspace Node.js when no release is named', () => {
    expect(nodeCommand(null, 'tools/probe.mjs')).toEqual(['node', 'tools/probe.mjs'])
  })

  it('fetches the named release through npx', () => {
    expect(nodeCommand('18.0.0', 'tools/probe.mjs')).toEqual(['npx', '-y', '-p', 'node@18.0.0', 'node', 'tools/probe.mjs'])
  })

  it.each([
    ['the probe on the workspace Node.js', null, PROBE_SCRIPT, ['node', 'tools/workspace/scripts/probe-node-floor.mjs']],
    [
      'the probe on a floor release',
      '20.1.0',
      PROBE_SCRIPT,
      ['npx', '-y', '-p', 'node@20.1.0', 'node', 'tools/workspace/scripts/probe-node-floor.mjs'],
    ],
    [
      'the smoke on the floor release',
      '20.1.0',
      'apps/alpha-e2e/scripts/consumer-smoke.mjs',
      ['npx', '-y', '-p', 'node@20.1.0', 'node', 'apps/alpha-e2e/scripts/consumer-smoke.mjs'],
    ],
    [
      'the smoke on the newest release of the major',
      '20',
      'apps/alpha-e2e/scripts/consumer-smoke.mjs',
      ['npx', '-y', '-p', 'node@20', 'node', 'apps/alpha-e2e/scripts/consumer-smoke.mjs'],
    ],
    [
      'the smoke on the workspace Node.js',
      null,
      'apps/beta-e2e/scripts/consumer-smoke.mjs',
      ['node', 'apps/beta-e2e/scripts/consumer-smoke.mjs'],
    ],
  ])('runs %s', (_kind: string, release: string | null, script: string, expected: readonly string[]) => {
    expect(nodeCommand(release, script)).toEqual(expected)
  })
})

describe('declaredFloor', () => {
  it.each([
    ['>=22.18.0', '22.18.0'],
    ['>= 24', '24.0.0'],
    ['>=20.1', '20.1.0'],
    ['^18', null],
    [undefined, null],
  ])('reads %s as %s', (range, floor) => {
    expect(declaredFloor(range)).toBe(floor)
  })
})

describe('majorOf', () => {
  it('keeps the major alone', () => {
    expect(majorOf('24.0.0')).toBe('24')
  })
})

describe('targetRank', () => {
  it('orders the pipeline targets prerequisites first and the rest last', () => {
    expect(['publish', 'typecheck', 'serve', 'build', 'install'].sort((left, right) => targetRank(left) - targetRank(right))).toEqual([
      'install',
      'typecheck',
      'build',
      'publish',
      'serve',
    ])
  })
})
