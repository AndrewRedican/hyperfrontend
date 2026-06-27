import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ascendForWorker, currentModuleDir } from './worker-locator'

const OFFSET = ['bundle', 'rollup', 'worker']

const writeWorkerAt = (root: string, ...segments: string[]): string => {
  const path = join(root, ...segments)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, '/* fake worker */', { flag: 'w' })
  return path
}

describe('currentModuleDir', () => {
  it('resolves the directory of the running module', () => {
    expect(currentModuleDir()).toEqual(expect.stringMatching(/builder[/\\]src[/\\]bundle$/))
  })
})

describe('ascendForWorker', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-worker-locator-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('defaults to the running module directory and finds the in-source worker', () => {
    expect(ascendForWorker(OFFSET)).toEqual({
      path: expect.stringMatching(/bundle[/\\]rollup[/\\]worker[/\\]index\.ts$/),
      execArgv: ['--require', '@swc-node/register'],
    })
  })

  it('returns undefined when no worker exists under any ancestor', () => {
    expect(ascendForWorker(OFFSET, root)).toBeUndefined()
  })

  it('returns the compiled worker when present at the offset', () => {
    const path = writeWorkerAt(root, ...OFFSET, 'index.cjs.js')
    expect(ascendForWorker(OFFSET, root)).toEqual({ path, execArgv: [] })
  })

  it('returns the source worker with the swc loader when only the .ts sibling exists', () => {
    const path = writeWorkerAt(root, ...OFFSET, 'index.ts')
    expect(ascendForWorker(OFFSET, root)).toEqual({ path, execArgv: ['--require', '@swc-node/register'] })
  })

  it('prefers the compiled worker over the source sibling', () => {
    const compiled = writeWorkerAt(root, ...OFFSET, 'index.cjs.js')
    writeWorkerAt(root, ...OFFSET, 'index.ts')
    expect(ascendForWorker(OFFSET, root)).toEqual({ path: compiled, execArgv: [] })
  })

  it('ascends from a nested start directory to a worker in an ancestor', () => {
    const path = writeWorkerAt(root, ...OFFSET, 'index.cjs.js')
    const nested = join(root, 'a', 'b', 'c')
    mkdirSync(nested, { recursive: true })
    expect(ascendForWorker(OFFSET, nested)).toEqual({ path, execArgv: [] })
  })

  it('returns the deepest matching ancestor', () => {
    writeWorkerAt(root, ...OFFSET, 'index.cjs.js')
    const deepRoot = join(root, 'nested')
    const deepPath = writeWorkerAt(deepRoot, ...OFFSET, 'index.cjs.js')
    expect(ascendForWorker(OFFSET, join(deepRoot, 'a', 'b'))).toEqual({ path: deepPath, execArgv: [] })
  })
})
