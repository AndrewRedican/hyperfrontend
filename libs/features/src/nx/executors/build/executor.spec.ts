import type { ExecutorContext } from '../../model'
import { runBuild } from '../../../cli'
import { warnIfRollupBindingMissing } from '../../shared/rollup-binding'
import runBuildExecutor from './executor'

jest.mock('../../../cli', () => ({ runBuild: jest.fn(), EXIT_OK: 0 }))
jest.mock('../../shared/rollup-binding', () => ({ warnIfRollupBindingMissing: jest.fn() }))

const runBuildMock = jest.mocked(runBuild)
const warnIfRollupBindingMissingMock = jest.mocked(warnIfRollupBindingMissing)
const context: ExecutorContext = {
  root: '/ws',
  projectName: 'lib-a',
  projectsConfigurations: { projects: { 'lib-a': { root: 'libs/a' } } },
}

describe('runBuildExecutor', () => {
  beforeEach(() => {
    runBuildMock.mockReset()
    warnIfRollupBindingMissingMock.mockReset()
  })

  it('reports success when the SDK build exits zero', async () => {
    runBuildMock.mockResolvedValue(0)
    expect(await runBuildExecutor({ config: './f.json' }, context)).toEqual({ success: true })
  })

  it('reports failure when the SDK build exits non-zero', async () => {
    runBuildMock.mockResolvedValue(1)
    expect(await runBuildExecutor({}, context)).toEqual({ success: false })
  })

  it('runs against the resolved project cwd', async () => {
    runBuildMock.mockResolvedValue(0)
    await runBuildExecutor({}, context)
    expect(runBuildMock).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/ws/libs/a' }))
  })

  it('forwards the allow-open acknowledgement to the SDK build', async () => {
    runBuildMock.mockResolvedValue(0)
    await runBuildExecutor({ protocol: 'none', allowOpen: true }, context)
    expect(runBuildMock).toHaveBeenCalledWith(
      expect.objectContaining({ flags: expect.objectContaining({ protocol: 'none', allowOpen: true }) })
    )
  })

  it('leaves the allow-open flag unset when the option is omitted', async () => {
    runBuildMock.mockResolvedValue(0)
    await runBuildExecutor({}, context)
    expect(runBuildMock).toHaveBeenCalledWith(expect.objectContaining({ flags: expect.objectContaining({ allowOpen: undefined }) }))
  })

  it('runs the rollup-binding advisory against the workspace root when the build fails', async () => {
    runBuildMock.mockResolvedValue(1)
    await runBuildExecutor({}, context)
    expect(warnIfRollupBindingMissingMock).toHaveBeenCalledWith('/ws')
  })

  it('skips the rollup-binding advisory when the build succeeds', async () => {
    runBuildMock.mockResolvedValue(0)
    await runBuildExecutor({}, context)
    expect(warnIfRollupBindingMissingMock).not.toHaveBeenCalled()
  })
})
