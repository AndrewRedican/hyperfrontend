import type { ExecutorContext } from '../../model'
import { runDev } from '../../../cli'
import { startDevServer } from '../../../server'
import { waitForShutdown } from '../../shared/shutdown'
import serveExecutor from './executor'

jest.mock('../../../cli', () => ({ runDev: jest.fn(), EXIT_OK: 0 }))
jest.mock('../../../server', () => ({ startDevServer: jest.fn() }))
jest.mock('../../shared/shutdown', () => ({ waitForShutdown: jest.fn() }))

const runDevMock = jest.mocked(runDev)
const startDevServerMock = jest.mocked(startDevServer)
const waitForShutdownMock = jest.mocked(waitForShutdown)
const context: ExecutorContext = {
  root: '/ws',
  projectName: 'lib-a',
  projectsConfigurations: { projects: { 'lib-a': { root: 'libs/a' } } },
}

/**
 * Wire runDev to invoke its injected startServer with the given handle.
 *
 * @param handle - The dev-server handle the mocked startServer resolves with.
 */
function startsWith(handle: unknown): void {
  startDevServerMock.mockResolvedValue(<never>handle)
  runDevMock.mockImplementation(async (options) => {
    await options.startServer?.(<never>{}, undefined)
    return 0
  })
  waitForShutdownMock.mockResolvedValue(undefined)
}

describe('serveExecutor', () => {
  beforeEach(() => {
    runDevMock.mockReset()
    startDevServerMock.mockReset()
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
