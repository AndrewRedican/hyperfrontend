import { relative, sep, posix } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { computeReachable } from './reachability'

describe('computeReachable', () => {
  const dir = useTempDir({ prefix: 'builder-reach-' })
  let depsRoot: string

  beforeEach(() => {
    depsRoot = dir.resolve('_dependencies')
  })

  const reachableRel = (set: Set<string>): string[] => [...set].map((p) => relative(dir.path, p).split(sep).join(posix.sep)).sort()

  it('follows chunk → chunk edges transitively and skips unreferenced chunks', () => {
    const entry = dir.write('index.mjs', "import {a} from './_dependencies/a/index.mjs'")
    dir.write('_dependencies/a/index.mjs', "import {b} from '../b/index.mjs'")
    dir.write('_dependencies/b/index.mjs', 'export const b = 1')
    dir.write('_dependencies/c/index.mjs', 'export const c = 1')
    const result = computeReachable([entry], depsRoot)
    expect(reachableRel(result as Set<string>)).toEqual(['_dependencies/a/index.mjs', '_dependencies/b/index.mjs', 'index.mjs'])
  })

  it('ignores edges that resolve outside the dependencies root', () => {
    const entry = dir.write('index.mjs', "import {x} from './sibling.esm.js'")
    dir.write('sibling.esm.js', 'export const x = 1')
    const result = computeReachable([entry], depsRoot)
    expect(reachableRel(result as Set<string>)).toEqual(['index.mjs'])
  })

  it('returns null when a reached _dependencies/ chunk contains a dynamic specifier', () => {
    const entry = dir.write('index.mjs', "import {a} from './_dependencies/a/index.mjs'")
    dir.write('_dependencies/a/index.mjs', 'const m = require(name)')
    expect(computeReachable([entry], depsRoot)).toBeNull()
  })

  it('does not bail on a dynamic specifier in a first-party root and still skips unreferenced chunks', () => {
    // why: a runtime `import(<expr>)` in first-party entry code targets external/user paths, never a bundled dep chunk, so it must not disable the sweep — otherwise emptied, unreferenced dep chunks are stranded.
    const entry = dir.write('index.mjs', "import {a} from './_dependencies/a/index.mjs'\nconst c = await import(userUrl)")
    dir.write('_dependencies/a/index.mjs', 'export const a = 1')
    dir.write('_dependencies/dead/index.mjs', 'export const dead = 1')
    const result = computeReachable([entry], depsRoot)
    expect(reachableRel(result as Set<string>)).toEqual(['_dependencies/a/index.mjs', 'index.mjs'])
  })

  it('skips root files that do not exist on disk', () => {
    const result = computeReachable([dir.resolve('missing.esm.js')], depsRoot)
    expect(reachableRel(result as Set<string>)).toEqual([])
  })

  it('terminates on cyclic chunk references without revisiting', () => {
    const entry = dir.write('index.mjs', "import {a} from './_dependencies/a/index.mjs'")
    dir.write('_dependencies/a/index.mjs', "import {b} from '../b/index.mjs'")
    dir.write('_dependencies/b/index.mjs', "import {a} from '../a/index.mjs'")
    const result = computeReachable([entry], depsRoot)
    expect(reachableRel(result as Set<string>)).toEqual(['_dependencies/a/index.mjs', '_dependencies/b/index.mjs', 'index.mjs'])
  })

  it('does not enqueue a duplicate root twice', () => {
    const entry = dir.write('index.mjs', 'export const x = 1')
    const result = computeReachable([entry, entry], depsRoot)
    expect(reachableRel(result as Set<string>)).toEqual(['index.mjs'])
  })
})
