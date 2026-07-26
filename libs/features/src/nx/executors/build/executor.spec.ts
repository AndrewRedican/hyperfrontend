import type { ExecutorContext } from '../../model'
import { runBuild } from '../../../cli'
import runBuildExecutor from './executor'

jest.mock('../../../cli', () => ({ runBuild: jest.fn(), EXIT_OK: 0 }))

const runBuildMock = jest.mocked(runBuild)
const context: ExecutorContext = {
  root: '/ws',
  projectName: 'lib-a',
  projectsConfigurations: { projects: { 'lib-a': { root: 'libs/a' } } },
}

describe('runBuildExecutor', () => {
  beforeEach(() => {
    runBuildMock.mockReset()
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
})
