import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { resolveDepEntry } from './resolve-dep-entry'

describe('resolveDepEntry', () => {
  const dir = useTempDir({ prefix: 'builder-dep-entry-' })

  const seedDep = (name: string, pkg: object, files: string[] = []): { projectRoot: string } => {
    dir.write(`project/node_modules/${name}/package.json`, pkg)
    for (const f of files) dir.write(`project/node_modules/${name}/${f}`, '')
    dir.write('project/package.json', '{}')
    return { projectRoot: dir.resolve('project') }
  }

  it('resolves the JS module entry when present', () => {
    const { projectRoot } = seedDep('demo', { name: 'demo', module: 'dist/index.mjs', main: 'dist/index.cjs' }, [
      'dist/index.mjs',
      'dist/index.cjs',
    ])
    const entry = resolveDepEntry({ dep: 'demo', projectRoot, workspaceRoot: dir.path, kind: 'js' })
    expect(entry.endsWith('dist/index.mjs')).toBe(true)
  })

  it('falls back to main when module is absent', () => {
    const { projectRoot } = seedDep('demo', { name: 'demo', main: 'dist/index.cjs' }, ['dist/index.cjs'])
    const entry = resolveDepEntry({ dep: 'demo', projectRoot, workspaceRoot: dir.path, kind: 'js' })
    expect(entry.endsWith('dist/index.cjs')).toBe(true)
  })

  it('resolves the dts entry from types', () => {
    const { projectRoot } = seedDep('demo', { name: 'demo', module: 'dist/index.mjs', types: 'dist/index.d.ts' }, [
      'dist/index.mjs',
      'dist/index.d.ts',
    ])
    const entry = resolveDepEntry({ dep: 'demo', projectRoot, workspaceRoot: dir.path, kind: 'dts' })
    expect(entry.endsWith('dist/index.d.ts')).toBe(true)
  })

  it('falls back to typings when types is absent', () => {
    const { projectRoot } = seedDep('demo', { name: 'demo', main: 'dist/index.cjs', typings: 'dist/index.d.ts' }, [
      'dist/index.cjs',
      'dist/index.d.ts',
    ])
    const entry = resolveDepEntry({ dep: 'demo', projectRoot, workspaceRoot: dir.path, kind: 'dts' })
    expect(entry.endsWith('dist/index.d.ts')).toBe(true)
  })

  it('throws when the package.json cannot be located', () => {
    const projectRoot = dir.resolve('project')
    dir.write('project/package.json', '{}')
    expect(() => resolveDepEntry({ dep: 'missing', projectRoot, workspaceRoot: dir.path, kind: 'js' })).toThrow(
      /cannot locate package.json/
    )
  })

  it('throws when the dep lacks a JS entry field', () => {
    const { projectRoot } = seedDep('demo', { name: 'demo' })
    expect(() => resolveDepEntry({ dep: 'demo', projectRoot, workspaceRoot: dir.path, kind: 'js' })).toThrow(/has no main\/module entry/)
  })

  it('throws when the dep lacks a dts entry field', () => {
    const { projectRoot } = seedDep('demo', { name: 'demo', main: 'dist/index.js' }, ['dist/index.js'])
    expect(() => resolveDepEntry({ dep: 'demo', projectRoot, workspaceRoot: dir.path, kind: 'dts' })).toThrow(/has no types\/typings entry/)
  })

  it('falls back to entry-walk when the dep restricts ./package.json via exports', () => {
    const projectRoot = dir.resolve('project')
    dir.writeTree({
      'project/node_modules/restricted/package.json': { name: 'restricted', main: './dist/index.js', exports: { '.': './dist/index.js' } },
      'project/node_modules/restricted/dist/index.js': '',
      'project/package.json': '{}',
    })
    const entry = resolveDepEntry({ dep: 'restricted', projectRoot, workspaceRoot: dir.path, kind: 'js' })
    expect(entry.endsWith('dist/index.js')).toBe(true)
  })

  it('handles absolute entry paths in the dep package.json', () => {
    const absolutePath = dir.write('absolute-entry.js', '')
    const projectRoot = dir.resolve('project')
    dir.write('project/node_modules/absdep/package.json', { name: 'absdep', main: absolutePath })
    dir.write('project/package.json', '{}')
    const entry = resolveDepEntry({ dep: 'absdep', projectRoot, workspaceRoot: dir.path, kind: 'js' })
    expect(entry).toContain('absolute-entry.js')
  })
})
