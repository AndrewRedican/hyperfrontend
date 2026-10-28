import type { ProjectRecord } from '../graph/model'
import type { CommandResult } from './execute'
import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createPipelineWorkspace } from './__test-utils__/workspace'
import { classifyView, npmProbe, registryDrift } from './registry'

const workspace = createPipelineWorkspace()

afterAll(() => workspace.remove())

/**
 * What npm ended as.
 *
 * @param fields - The fields that differ from a clean exit
 * @returns The result
 */
function ended(fields: Partial<CommandResult>): CommandResult {
  return { exitCode: 0, signal: null, output: '', stdout: '', stderr: '', timedOut: false, error: null, ...fields }
}

describe('classifyView', () => {
  it.each([
    ['the version printed', ended({ stdout: '"1.2.0"\n' }), 'present'],
    ['a 404', ended({ stderr: 'npm error code E404\n' }), 'absent'],
    ['a 404 after a timeout', ended({ stderr: 'npm error code E404\n', timedOut: true }), 'unknown'],
    ['a 404 when npm could not start', ended({ stderr: 'E404', error: 'spawn npm ENOENT' }), 'unknown'],
    ['another version printed', ended({ stdout: '"1.1.0"\n' }), 'unknown'],
    ['another error', ended({ exitCode: 1, stderr: 'npm error code ECONNRESET\n' }), 'unknown'],
  ])('classifies %s', (_, result, presence) => {
    expect(classifyView(result, '1.2.0')).toBe(presence)
  })
})

describe('npmProbe', () => {
  it('asks npm about the exact version as JSON', async () => {
    const calls: unknown[] = []
    const probe = npmProbe({
      cwd: '/w',
      timeoutMs: 5,
      run: async (command, options) => {
        calls.push([command, options])
        return ended({ stdout: '"1.0.0"' })
      },
    })
    await probe('@fixture/alpha', '1.0.0')
    expect(calls).toEqual([[['npm', 'view', '@fixture/alpha@1.0.0', 'version', '--json'], { cwd: '/w', timeoutMs: 5 }]])
  })

  it('answers what the view means', async () => {
    const probe = npmProbe({ cwd: '/w', run: async () => ended({ stderr: 'E404' }) })
    expect(await probe('@fixture/alpha', '1.0.0')).toBe('absent')
  })

  it('limits a query to thirty seconds by default', async () => {
    const limits: unknown[] = []
    const probe = npmProbe({
      cwd: '/w',
      run: async (_, options) => {
        limits.push(options.timeoutMs)
        return ended({})
      },
    })
    await probe('@fixture/alpha', '1.0.0')
    expect(limits).toEqual([30_000])
  })
})

describe('registryDrift', () => {
  it('names the publishable libraries whose version is absent, sorted', async () => {
    const drift = await registryDrift(workspace.graph.projects.values(), async (name) =>
      name === '@fixture/alpha' || name === '@fixture/beta' ? 'absent' : 'present'
    )
    expect(drift).toEqual(['lib-alpha', 'lib-beta'])
  })

  it('never asks about private, stub, unnamed or unversioned packages', async () => {
    const asked: string[] = []
    const alpha = workspace.graph.projects.get('lib-alpha') as ProjectRecord
    await registryDrift(
      [
        ...workspace.graph.projects.values(),
        { ...alpha, name: 'lib-unversioned', manifest: { name: '@fixture/unversioned' } },
        { ...alpha, name: 'lib-unnamed', manifest: { version: '1.0.0' } },
        { ...alpha, name: 'lib-stub', manifest: { name: '@fixture/stub', version: '0.0.0' } },
      ],
      async (name) => {
        asked.push(name)
        return 'present'
      }
    )
    expect(asked.sort()).toEqual(['@fixture/alpha', '@fixture/beta'])
  })

  it('treats an unknown answer as present', async () => {
    expect(await registryDrift(workspace.graph.projects.values(), async () => 'unknown')).toEqual([])
  })
})
