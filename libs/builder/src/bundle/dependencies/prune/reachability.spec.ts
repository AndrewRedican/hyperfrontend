import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep, posix } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
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

  const reachableRel = (set: Set<string>): string[] => [...set].map((p) => relative(root, p).split(sep).join(posix.sep)).sort()

  it('follows chunk → chunk edges transitively and skips unreferenced chunks', () => {
    const entry = write(root, 'index.mjs', "import {a} from './_dependencies/a/index.mjs'")
    write(root, '_dependencies/a/index.mjs', "import {b} from '../b/index.mjs'")
    write(root, '_dependencies/b/index.mjs', 'export const b = 1')
    write(root, '_dependencies/c/index.mjs', 'export const c = 1')
    const result = computeReachable([entry], depsRoot)
    expect(reachableRel(result as Set<string>)).toEqual(['_dependencies/a/index.mjs', '_dependencies/b/index.mjs', 'index.mjs'])
  })

  it('ignores edges that resolve outside the dependencies root', () => {
    const entry = write(root, 'index.mjs', "import {x} from './sibling.esm.js'")
    write(root, 'sibling.esm.js', 'export const x = 1')
    const result = computeReachable([entry], depsRoot)
    expect(reachableRel(result as Set<string>)).toEqual(['index.mjs'])
  })

  it('returns null when a reached _dependencies/ chunk contains a dynamic specifier', () => {
    const entry = write(root, 'index.mjs', "import {a} from './_dependencies/a/index.mjs'")
    write(root, '_dependencies/a/index.mjs', 'const m = require(name)')
    expect(computeReachable([entry], depsRoot)).toBeNull()
  })

  it('does not bail on a dynamic specifier in a first-party root and still skips unreferenced chunks', () => {
    // why: a runtime `import(<expr>)` in first-party entry code targets external/user paths, never a bundled dep chunk, so it must not disable the sweep — otherwise emptied, unreferenced dep chunks are stranded.
    const entry = write(root, 'index.mjs', "import {a} from './_dependencies/a/index.mjs'\nconst c = await import(userUrl)")
    write(root, '_dependencies/a/index.mjs', 'export const a = 1')
    write(root, '_dependencies/dead/index.mjs', 'export const dead = 1')
    const result = computeReachable([entry], depsRoot)
    expect(reachableRel(result as Set<string>)).toEqual(['_dependencies/a/index.mjs', 'index.mjs'])
  })

  it('skips root files that do not exist on disk', () => {
    const result = computeReachable([join(root, 'missing.esm.js')], depsRoot)
    expect(reachableRel(result as Set<string>)).toEqual([])
  })

  it('terminates on cyclic chunk references without revisiting', () => {
    const entry = write(root, 'index.mjs', "import {a} from './_dependencies/a/index.mjs'")
    write(root, '_dependencies/a/index.mjs', "import {b} from '../b/index.mjs'")
    write(root, '_dependencies/b/index.mjs', "import {a} from '../a/index.mjs'")
    const result = computeReachable([entry], depsRoot)
    expect(reachableRel(result as Set<string>)).toEqual(['_dependencies/a/index.mjs', '_dependencies/b/index.mjs', 'index.mjs'])
  })

  it('does not enqueue a duplicate root twice', () => {
    const entry = write(root, 'index.mjs', 'export const x = 1')
    const result = computeReachable([entry, entry], depsRoot)
    expect(reachableRel(result as Set<string>)).toEqual(['index.mjs'])
  })
})
