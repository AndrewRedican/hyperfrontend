import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { computeReachable } from './reachability'

const write = (root: string, relPath: string, content: string): string => {
  const abs = join(root, relPath)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, content)
  return abs
}

describe('computeReachable', () => {
  let root: string
  let depsRoot: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-reach-'))
    depsRoot = join(root, '_dependencies')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const reachableRel = (set: Set<string>): string[] => [...set].map((p) => relative(root, p)).sort()

  it('follows chunk → chunk edges transitively and skips unreferenced chunks', () => {
    const entry = write(root, 'index.esm.js', "import {a} from './_dependencies/a/index.esm.js'")
    write(root, '_dependencies/a/index.esm.js', "import {b} from '../b/index.esm.js'")
    write(root, '_dependencies/b/index.esm.js', 'export const b = 1')
    write(root, '_dependencies/c/index.esm.js', 'export const c = 1')
    const result = computeReachable([entry], depsRoot)
    expect(reachableRel(<Set<string>>result)).toEqual(['_dependencies/a/index.esm.js', '_dependencies/b/index.esm.js', 'index.esm.js'])
  })

  it('ignores edges that resolve outside the dependencies root', () => {
    const entry = write(root, 'index.esm.js', "import {x} from './sibling.esm.js'")
    write(root, 'sibling.esm.js', 'export const x = 1')
    const result = computeReachable([entry], depsRoot)
    expect(reachableRel(<Set<string>>result)).toEqual(['index.esm.js'])
  })

  it('returns null when a reached _dependencies/ chunk contains a dynamic specifier', () => {
    const entry = write(root, 'index.esm.js', "import {a} from './_dependencies/a/index.esm.js'")
    write(root, '_dependencies/a/index.esm.js', 'const m = require(name)')
    expect(computeReachable([entry], depsRoot)).toBeNull()
  })

  it('does not bail on a dynamic specifier in a first-party root and still skips unreferenced chunks', () => {
    // why: a runtime `import(<expr>)` in first-party entry code targets external/user paths, never a bundled dep chunk, so it must not disable the sweep — otherwise emptied, unreferenced dep chunks are stranded.
    const entry = write(root, 'index.esm.js', "import {a} from './_dependencies/a/index.esm.js'\nconst c = await import(userUrl)")
    write(root, '_dependencies/a/index.esm.js', 'export const a = 1')
    write(root, '_dependencies/dead/index.esm.js', 'export const dead = 1')
    const result = computeReachable([entry], depsRoot)
    expect(reachableRel(<Set<string>>result)).toEqual(['_dependencies/a/index.esm.js', 'index.esm.js'])
  })

  it('skips root files that do not exist on disk', () => {
    const result = computeReachable([join(root, 'missing.esm.js')], depsRoot)
    expect(reachableRel(<Set<string>>result)).toEqual([])
  })

  it('terminates on cyclic chunk references without revisiting', () => {
    const entry = write(root, 'index.esm.js', "import {a} from './_dependencies/a/index.esm.js'")
    write(root, '_dependencies/a/index.esm.js', "import {b} from '../b/index.esm.js'")
    write(root, '_dependencies/b/index.esm.js', "import {a} from '../a/index.esm.js'")
    const result = computeReachable([entry], depsRoot)
    expect(reachableRel(<Set<string>>result)).toEqual(['_dependencies/a/index.esm.js', '_dependencies/b/index.esm.js', 'index.esm.js'])
  })

  it('does not enqueue a duplicate root twice', () => {
    const entry = write(root, 'index.esm.js', 'export const x = 1')
    const result = computeReachable([entry, entry], depsRoot)
    expect(reachableRel(<Set<string>>result)).toEqual(['index.esm.js'])
  })
})
