import type { MockedFunction } from '@hyperfrontend/testing'
import * as childProcess from 'node:child_process'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { getStagedPaths } from './staged-paths'

jest.mock('node:child_process')

const execFileSync = childProcess.execFileSync as MockedFunction<typeof childProcess.execFileSync>

/**
 * Configures the execFileSync mock to answer `rev-parse --show-toplevel` with
 * the given root and every other git invocation with the given diff output.
 *
 * @param repoRoot - Toplevel path git should report (raw, may carry a newline)
 * @param diffOutput - NUL-separated staged-paths output
 */
function mockGit(repoRoot: string, diffOutput: string): void {
  execFileSync.mockImplementation((_command, args) => ((args as readonly string[])[0] === 'rev-parse' ? repoRoot : diffOutput))
}

describe('getStagedPaths', () => {
  beforeEach(() => {
    execFileSync.mockReset()
  })

  it('anchors each NUL-terminated entry at the repository root', () => {
    mockGit('/repo\n', 'libs/a/index.ts\0libs/b/index.ts\0')
    expect(getStagedPaths({ cwd: '/repo' })).toEqual(['/repo/libs/a/index.ts', '/repo/libs/b/index.ts'])
  })

  it('returns root-anchored paths when invoked from a subdirectory', () => {
    mockGit('/repo\n', 'libs/a/index.ts\0')
    expect(getStagedPaths({ cwd: '/repo/apps/demo' })).toEqual(['/repo/libs/a/index.ts'])
    expect(execFileSync).toHaveBeenCalledWith('git', ['rev-parse', '--show-toplevel'], expect.objectContaining({ cwd: '/repo/apps/demo' }))
  })

  it('returns an empty list when nothing is staged', () => {
    mockGit('/repo\n', '')
    expect(getStagedPaths({ cwd: '/repo' })).toEqual([])
  })

  it('handles trailing content with no terminator', () => {
    mockGit('/repo\n', 'libs/a/index.ts')
    expect(getStagedPaths({ cwd: '/repo' })).toEqual(['/repo/libs/a/index.ts'])
  })

  it('wraps git errors with a descriptive message', () => {
    execFileSync.mockImplementation(() => {
      throw new Error('not a git repo')
    })
    expect(() => getStagedPaths({ cwd: '/repo' })).toThrow('Failed to read staged paths: not a git repo')
  })
})
