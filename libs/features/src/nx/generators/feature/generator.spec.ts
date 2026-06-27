import type { Tree } from '../../model'
import { runInit } from '../../../cli'
import { featureGenerator } from './generator'

jest.mock('../../../cli', () => ({ runInit: jest.fn(), EXIT_OK: 0 }))

const runInitMock = jest.mocked(runInit)
const tree = <Tree>{ root: '/ws' }
const baseOptions = { name: 'clock', contract: './c.json', entry: './src/main.ts' }

describe('featureGenerator', () => {
  beforeEach(() => {
    runInitMock.mockReset()
    runInitMock.mockResolvedValue(0)
  })

  it('delegates to runInit with mapped headless flags and resolved cwd', async () => {
    await featureGenerator(tree, { ...baseOptions, directory: 'apps/clock' })
    expect(runInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/ws/apps/clock',
        flags: expect.objectContaining({ name: 'clock', contract: './c.json', entry: './src/main.ts', ci: true }),
      })
    )
  })

  it('defaults the directory to the workspace root', async () => {
    await featureGenerator(tree, baseOptions)
    expect(runInitMock).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/ws' }))
  })

  it('throws when the SDK run exits non-zero', async () => {
    runInitMock.mockResolvedValue(1)
    await expect(featureGenerator(tree, baseOptions)).rejects.toThrow('hf init failed with exit code 1.')
  })
})
