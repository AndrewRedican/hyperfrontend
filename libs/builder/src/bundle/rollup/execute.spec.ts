jest.mock('@hyperfrontend/logging', () => {
  const actual = jest.requireActual('@hyperfrontend/logging')
  const mockChannel = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() }
  return {
    ...actual,
    logger: { channel: jest.fn(() => mockChannel) },
    __mockChannel: mockChannel,
  }
})

jest.mock('rollup', () => ({
  rollup: jest.fn(),
}))

import type { RollupOptions } from 'rollup'
import { rollup } from 'rollup'
import { executeRollup } from './execute'

const writeMock = jest.fn().mockResolvedValue(undefined)
const closeMock = jest.fn().mockResolvedValue(undefined)

beforeEach(() => {
  ;(<jest.Mock>rollup).mockReset()
  writeMock.mockClear()
  closeMock.mockClear()
  ;(<jest.Mock>rollup).mockResolvedValue({ write: writeMock, close: closeMock })
})

describe('executeRollup', () => {
  it('writes every output declared on the config and closes the bundle afterwards', async () => {
    const config: RollupOptions = {
      input: '/abs/src/index.ts',
      output: [{ file: '/abs/out/index.esm.js', format: 'esm' }],
    }
    await executeRollup(config, 'esm')
    expect(writeMock).toHaveBeenCalledTimes(1)
  })

  it('closes the bundle exactly once even when multiple outputs are written', async () => {
    const config: RollupOptions = {
      input: '/abs/src/index.ts',
      output: [
        { file: '/abs/out/a.js', format: 'esm' },
        { file: '/abs/out/b.js', format: 'esm' },
      ],
    }
    await executeRollup(config, 'esm')
    expect(closeMock).toHaveBeenCalledTimes(1)
  })

  it('treats a single output object the same as a one-element array', async () => {
    const config: RollupOptions = { input: '/abs/src/index.ts', output: { file: '/abs/out/index.cjs.js', format: 'cjs' } }
    await executeRollup(config, 'cjs')
    expect(writeMock).toHaveBeenCalledWith(expect.objectContaining({ file: '/abs/out/index.cjs.js' }))
  })

  it('skips writing when the config has no output declared', async () => {
    const config: RollupOptions = { input: '/abs/src/index.ts' }
    await executeRollup(config, 'no-output')
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('still closes the bundle when a write throws', async () => {
    writeMock.mockRejectedValueOnce(new Error('disk full'))
    const config: RollupOptions = { input: '/abs/src/index.ts', output: { file: '/abs/out/x.js', format: 'esm' } }
    await expect(executeRollup(config, 'esm')).rejects.toThrow('disk full')
    expect(closeMock).toHaveBeenCalledTimes(1)
  })

  it('clears every key on the supplied config to encourage prompt garbage collection', async () => {
    const config: RollupOptions = { input: '/abs/src/index.ts', output: { file: '/abs/out/x.js', format: 'esm' } }
    await executeRollup(config, 'esm')
    expect(config.input).toBeUndefined()
  })

  it('emits an info-level pre-rollup snapshot with parent heap, rss, and free memory', async () => {
    const { __mockChannel: mockChannel } = jest.requireMock('@hyperfrontend/logging') as {
      __mockChannel: { info: jest.Mock; debug: jest.Mock }
    }
    mockChannel.info.mockClear()
    const config: RollupOptions = { input: '/abs/src/index.ts', output: { file: '/abs/out/x.js', format: 'esm' } }
    await executeRollup(config, 'esm:./foo')
    expect(mockChannel.info).toHaveBeenCalledWith(
      expect.stringMatching(/^pre-rollup esm:\.\/foo: heap=[\d.]+MB rss=[\d.]+MB free=[\d.]+MB$/)
    )
  })
})
