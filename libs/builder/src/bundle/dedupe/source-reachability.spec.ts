import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { collectReachableSources } from './source-reachability'

describe('collectReachableSources', () => {
  let srcRoot: string

  beforeEach(() => {
    srcRoot = join(mkdtempSync(join(tmpdir(), 'builder-source-reachability-')), 'src')
    mkdirSync(srcRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(join(srcRoot, '..'), { recursive: true, force: true })
  })

  const write = (relPath: string, content: string): string => {
    const abs = join(srcRoot, relPath)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, content)
    return abs
  }

  const reachable = (entries: string[]): string[] => collectReachableSources(entries, srcRoot).sort()

  it('returns just the entry for a leaf module', () => {
    expect(reachable([write('index.ts', 'export const a = 1')])).toEqual([join(srcRoot, 'index.ts')])
  })

  it('follows static relative imports', () => {
    write('helper.ts', 'export const h = 1')
    expect(reachable([write('index.ts', "import { h } from './helper'\nexport const a = h")])).toEqual([
      join(srcRoot, 'helper.ts'),
      join(srcRoot, 'index.ts'),
    ])
  })

  it('follows re-export declarations', () => {
    write('models.ts', 'export const m = 1')
    expect(reachable([write('index.ts', "export { m } from './models'")])).toEqual(
      [join(srcRoot, 'models.ts'), join(srcRoot, 'index.ts')].sort()
    )
  })

  it('follows string-literal dynamic imports', () => {
    write('lazy.ts', 'export const l = 1')
    expect(reachable([write('index.ts', "export const load = async () => import('./lazy')")])).toEqual(
      [join(srcRoot, 'lazy.ts'), join(srcRoot, 'index.ts')].sort()
    )
  })

  it('resolves a directory specifier to its index module', () => {
    write('events/index.ts', 'export const e = 1')
    expect(reachable([write('index.ts', "export { e } from './events'")])).toEqual(
      [join(srcRoot, 'events/index.ts'), join(srcRoot, 'index.ts')].sort()
    )
  })

  it('ignores bare package specifiers', () => {
    expect(reachable([write('index.ts', "import ts from 'typescript'\nexport const a = ts")])).toEqual([join(srcRoot, 'index.ts')])
  })

  it('ignores relative targets that resolve to no source module', () => {
    write('v4.json', '{}')
    expect(reachable([write('index.ts', "import schema from './v4.json'\nexport const s = schema")])).toEqual([join(srcRoot, 'index.ts')])
  })

  it('never leaves the source root', () => {
    writeFileSync(join(srcRoot, '..', 'outside.ts'), 'export const o = 1')
    expect(reachable([write('index.ts', "import { o } from '../outside'\nexport const a = o")])).toEqual([join(srcRoot, 'index.ts')])
  })

  it('drops entry files that do not exist', () => {
    expect(reachable([join(srcRoot, 'missing.ts')])).toEqual([])
  })

  it('terminates on import cycles', () => {
    write('a.ts', "import { b } from './b'\nexport const a = b")
    write('b.ts', "import { a } from './a'\nexport const b = 1")
    expect(reachable([write('index.ts', "export { a } from './a'")])).toEqual(
      [join(srcRoot, 'a.ts'), join(srcRoot, 'b.ts'), join(srcRoot, 'index.ts')].sort()
    )
  })

  it('leaves spec-only fixture modules unreachable', () => {
    write('creators/mocks.ts', "export const id = 'fixture'")
    expect(reachable([write('index.ts', 'export const a = 1')])).toEqual([join(srcRoot, 'index.ts')])
  })
})
