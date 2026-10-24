import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { ascendForWorker, currentModuleDir } from './worker-locator'

const OFFSET = ['bundle', 'rollup', 'worker']

describe('currentModuleDir', () => {
  it('resolves the directory of the running module', () => {
    expect(currentModuleDir()).toEqual(expect.stringMatching(/builder[/\\]src[/\\]bundle$/))
  })
})

describe('ascendForWorker', () => {
  const dir = useTempDir({ prefix: 'builder-worker-locator-' })

  const writeWorkerAt = (...segments: string[]): string => dir.write(join(...segments), '/* fake worker */')

  it('defaults to the running module directory and finds the in-source worker', () => {
    expect(ascendForWorker(OFFSET)).toEqual({
      path: expect.stringMatching(/bundle[/\\]rollup[/\\]worker[/\\]index\.ts$/),
      execArgv: ['--require', '@swc-node/register'],
    })
  })

  it('returns undefined when no worker exists under any ancestor', () => {
    expect(ascendForWorker(OFFSET, dir.path)).toBeUndefined()
  })

  it('returns the compiled worker when present at the offset', () => {
    const path = writeWorkerAt(...OFFSET, 'index.cjs')
    expect(ascendForWorker(OFFSET, dir.path)).toEqual({ path, execArgv: [] })
  })

  it('returns the source worker with the swc loader when only the .ts sibling exists', () => {
    const path = writeWorkerAt(...OFFSET, 'index.ts')
    expect(ascendForWorker(OFFSET, dir.path)).toEqual({ path, execArgv: ['--require', '@swc-node/register'] })
  })

  it('prefers the compiled worker over the source sibling', () => {
    const compiled = writeWorkerAt(...OFFSET, 'index.cjs')
    writeWorkerAt(...OFFSET, 'index.ts')
    expect(ascendForWorker(OFFSET, dir.path)).toEqual({ path: compiled, execArgv: [] })
  })

  it('ascends from a nested start directory to a worker in an ancestor', () => {
    const path = writeWorkerAt(...OFFSET, 'index.cjs')
    const nested = dir.mkdir('a/b/c')
    expect(ascendForWorker(OFFSET, nested)).toEqual({ path, execArgv: [] })
  })

  it('returns the deepest matching ancestor', () => {
    writeWorkerAt(...OFFSET, 'index.cjs')
    const deepPath = writeWorkerAt('nested', ...OFFSET, 'index.cjs')
    expect(ascendForWorker(OFFSET, dir.resolve('nested', 'a', 'b'))).toEqual({ path: deepPath, execArgv: [] })
  })
})
