import type { ExecutorContext } from '../../model'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { runDev } from '../../../cli'
import { waitForShutdown } from '../../../shared/shutdown'
import serveExecutor from './executor'

jest.mock('../../../cli', () => ({ runDev: jest.fn(), EXIT_OK: 0 }))
jest.mock('../../../shared/shutdown', () => ({ waitForShutdown: jest.fn() }))

const runDevMock = jest.mocked(runDev)
const waitForShutdownMock = jest.mocked(waitForShutdown)
const context: ExecutorContext = {
  root: '/ws',
  projectName: 'lib-a',
  projectsConfigurations: { projects: { 'lib-a': { root: 'libs/a' } } },
}

/**
 * Wire runDev to hand the given handle to its injected `waitForClose` and
 * resolve successfully, mirroring a clean startup.
 *
 * @param handle - The dev-server handle passed to the injected wait.
 */
function startsWith(handle: unknown): void {
  runDevMock.mockImplementation(async (options) => {
    await options.waitForClose?.(handle as never)
    return 0
  })
  waitForShutdownMock.mockResolvedValue(undefined)
}

describe('serveExecutor', () => {
  beforeEach(() => {
    runDevMock.mockReset()
    waitForShutdownMock.mockReset()
  })

  it('yields success once the dev server is listening', async () => {
    startsWith({ close: jest.fn() })
    expect(await serveExecutor({}, context).next()).toEqual({ value: { success: true }, done: false })
  })

  it('closes the captured handle on shutdown', async () => {
    const handle = { close: jest.fn().mockResolvedValue(undefined) }
    startsWith(handle)
    const generator = serveExecutor({}, context)
    await generator.next()
    await generator.next()
    expect(handle.close).toHaveBeenCalled()
  })

  it('completes without closing when no handle was captured', async () => {
    runDevMock.mockResolvedValue(0)
    waitForShutdownMock.mockResolvedValue(undefined)
    const generator = serveExecutor({}, context)
    await generator.next()
    expect((await generator.next()).done).toBe(true)
  })

  it('yields failure when the dev server fails to start', async () => {
    runDevMock.mockResolvedValue(1)
    expect(await serveExecutor({}, context).next()).toEqual({ value: { success: false }, done: false })
  })

  it('completes without serving after a failed start', async () => {
    runDevMock.mockResolvedValue(1)
    const generator = serveExecutor({}, context)
    await generator.next()
    expect((await generator.next()).done).toBe(true)
  })
})
