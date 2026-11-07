import type { Mock } from '@hyperfrontend/testing'
import { join, posix, relative, sep } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { captureStdio } from '@hyperfrontend/testing/process'
import { runProjectTests } from '@hyperfrontend/testing/runner'
import { runTestsCli } from './runner'

jest.mock('@hyperfrontend/testing/runner', () => ({ runProjectTests: jest.fn() }))

const mockRun = runProjectTests as Mock

const workspace = useTempDir({
  prefix: 'test-runner-',
  tree: {
    'with-default.mjs': "export default { environments: [{ name: 'fixture', testMatch: ['src/**/*.spec.ts'] }] }\n",
    'no-default.mjs': 'export const environments = []\n',
  },
})

/**
 * The outcome of a run with no coverage rows and no failures.
 *
 * @param success - Whether the run passed
 * @param coverageTable - The rows of the coverage table
 * @param failures - The lines describing what failed
 * @returns The outcome the runner answers with
 */
function outcome(success: boolean, coverageTable: readonly string[] = [], failures: readonly string[] = []): unknown {
  return { success, coverageTable, failures }
}

/**
 * The arguments of a run over a configuration module of the temporary workspace.
 *
 * @param config - The configuration module, relative to the workspace
 * @returns The four positional arguments
 */
function argvFor(config: string): string[] {
  return ['/workspace', '/workspace/libs/a', '/workspace/coverage/libs/a', join(workspace.path, config)]
}

beforeEach(() => {
  mockRun.mockReset()
})

describe('runTestsCli', () => {
  it('hands the configuration the module exports to the runner, with the three directories it was given', async () => {
    mockRun.mockReturnValueOnce(outcome(true))
    await runTestsCli(argvFor('with-default.mjs'))
    expect(mockRun.mock.calls).toEqual([
      [
        { environments: [{ name: 'fixture', testMatch: ['src/**/*.spec.ts'] }] },
        { workspaceRoot: '/workspace', projectRoot: '/workspace/libs/a', coverageDir: '/workspace/coverage/libs/a' },
      ],
    ])
  })

  it('resolves a configuration module named relative to the working directory', async () => {
    mockRun.mockReturnValueOnce(outcome(true))
    const [workspaceRoot, projectRoot, coverageDir] = argvFor('with-default.mjs') as [string, string, string]
    await runTestsCli([
      workspaceRoot,
      projectRoot,
      coverageDir,
      relative(process.cwd(), join(workspace.path, 'with-default.mjs')).split(sep).join(posix.sep),
    ])
    expect(mockRun.mock.calls[0]?.[0]).toEqual({ environments: [expect.objectContaining({ name: 'fixture' })] })
  })

  it('answers 0 when the run passed', async () => {
    mockRun.mockReturnValueOnce(outcome(true))
    await expect(runTestsCli(argvFor('with-default.mjs'))).resolves.toBe(0)
  })

  it('answers 1 when the run failed', async () => {
    mockRun.mockReturnValueOnce(outcome(false))
    await expect(runTestsCli(argvFor('with-default.mjs'))).resolves.toBe(1)
  })

  it('prints the coverage table on standard output and the failures on standard error, a line each', async () => {
    mockRun.mockReturnValueOnce(outcome(false, ['File | Lines', 'a.ts | 100'], ['a.spec.ts failed', 'branches under 100']))
    const stdio = captureStdio()
    await runTestsCli(argvFor('with-default.mjs'))
    stdio.restore()
    expect({ stdout: stdio.stdout(), stderr: stdio.stderr() }).toEqual({
      stdout: 'File | Lines\na.ts | 100\n',
      stderr: 'a.spec.ts failed\nbranches under 100\n',
    })
  })

  it('refuses a configuration module without a default export, naming it', async () => {
    await expect(runTestsCli(argvFor('no-default.mjs'))).rejects.toThrow(`${join(workspace.path, 'no-default.mjs')} has no default export`)
  })

  it('does not start the runner for a configuration module without a default export', async () => {
    await runTestsCli(argvFor('no-default.mjs')).catch(() => undefined)
    expect(mockRun).not.toHaveBeenCalled()
  })

  it.each([
    ['the workspace root', ['', '/p', '/c', '/m.mjs']],
    ['the project root', ['/w', '', '/c', '/m.mjs']],
    ['the coverage directory', ['/w', '/p', '', '/m.mjs']],
    ['the configuration module', ['/w', '/p', '/c', '']],
    ['every argument', []],
  ])('fails early without %s', async (_, argv) => {
    await expect(runTestsCli(argv)).rejects.toThrow('expected <workspaceRoot> <projectRoot> <coverageDir> <configPath>')
  })
})
