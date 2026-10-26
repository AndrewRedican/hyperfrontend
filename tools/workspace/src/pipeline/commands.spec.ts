import { describe, expect, it } from '@hyperfrontend/testing'
import { declaredFloor, majorOf, nodeCommand, nxCommand, targetRank } from './commands'

describe('nxCommand', () => {
  it('runs the task through npx nx run', () => {
    expect(nxCommand('lib-a:build')).toEqual(['npx', 'nx', 'run', 'lib-a:build'])
  })
})

describe('nodeCommand', () => {
  it('runs the script on the workspace Node.js when no release is named', () => {
    expect(nodeCommand(null, 'tools/probe.mjs')).toEqual(['node', 'tools/probe.mjs'])
  })

  it('fetches the named release through npx', () => {
    expect(nodeCommand('18.0.0', 'tools/probe.mjs')).toEqual(['npx', '-y', '-p', 'node@18.0.0', 'node', 'tools/probe.mjs'])
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
