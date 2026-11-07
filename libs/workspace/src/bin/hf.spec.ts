import type { Mock } from '@hyperfrontend/testing'
import { promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { runWorkspaceCli } from '../cli/run'
import { runHf } from './hf'

jest.mock('../cli/run', () => ({ runWorkspaceCli: jest.fn() }))

const mockCli = runWorkspaceCli as Mock

describe('runHf', () => {
  it('runs the command line on the arguments and directory given and the streams of this process', async () => {
    mockCli.mockReturnValueOnce(promiseResolve(0))
    await runHf({ argv: ['show', 'projects'], cwd: '/workspace/libs/a' })
    expect(mockCli).toHaveBeenLastCalledWith({
      argv: ['show', 'projects'],
      cwd: '/workspace/libs/a',
      stdout: process.stdout,
      stderr: process.stderr,
    })
  })

  it('answers with the exit code of the command line', async () => {
    mockCli.mockReturnValueOnce(promiseResolve(7))
    await expect(runHf({ argv: [], cwd: '/workspace' })).resolves.toBe(7)
  })
})
