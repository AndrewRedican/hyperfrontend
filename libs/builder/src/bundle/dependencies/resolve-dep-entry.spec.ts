import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { resolveDepEntry } from './resolve-dep-entry'

describe('resolveDepEntry', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-dep-entry-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const seedDep = (name: string, pkg: object, files: string[] = []): { projectRoot: string } => {
    const projectRoot = join(root, 'project')
    const depDir = join(root, 'project', 'node_modules', name)
    mkdirSync(depDir, { recursive: true })
    writeFileSync(join(depDir, 'package.json'), JSON.stringify(pkg))
    for (const f of files) {
      const filePath = join(depDir, f)
      mkdirSync(filePath.substring(0, filePath.lastIndexOf('/')), { recursive: true })
      writeFileSync(filePath, '')
    }
    mkdirSync(projectRoot, { recursive: true })
    writeFileSync(join(projectRoot, 'package.json'), '{}')
    return { projectRoot }
  }

  it('resolves the JS module entry when present', () => {
    const { projectRoot } = seedDep('demo', { name: 'demo', module: 'dist/index.mjs', main: 'dist/index.cjs' }, [
      'dist/index.mjs',
      'dist/index.cjs',
    ])
    const entry = resolveDepEntry({ dep: 'demo', projectRoot, workspaceRoot: root, kind: 'js' })
    expect(entry.endsWith('dist/index.mjs')).toBe(true)
  })

  it('falls back to main when module is absent', () => {
    const { projectRoot } = seedDep('demo', { name: 'demo', main: 'dist/index.cjs' }, ['dist/index.cjs'])
    const entry = resolveDepEntry({ dep: 'demo', projectRoot, workspaceRoot: root, kind: 'js' })
    expect(entry.endsWith('dist/index.cjs')).toBe(true)
  })

  it('resolves the dts entry from types', () => {
    const { projectRoot } = seedDep('demo', { name: 'demo', module: 'dist/index.mjs', types: 'dist/index.d.ts' }, [
      'dist/index.mjs',
      'dist/index.d.ts',
    ])
    const entry = resolveDepEntry({ dep: 'demo', projectRoot, workspaceRoot: root, kind: 'dts' })
    expect(entry.endsWith('dist/index.d.ts')).toBe(true)
  })

  it('falls back to typings when types is absent', () => {
    const { projectRoot } = seedDep('demo', { name: 'demo', main: 'dist/index.cjs', typings: 'dist/index.d.ts' }, [
      'dist/index.cjs',
      'dist/index.d.ts',
    ])
    const entry = resolveDepEntry({ dep: 'demo', projectRoot, workspaceRoot: root, kind: 'dts' })
    expect(entry.endsWith('dist/index.d.ts')).toBe(true)
  })

  it('throws when the package.json cannot be located', () => {
    const projectRoot = join(root, 'project')
    mkdirSync(projectRoot, { recursive: true })
    writeFileSync(join(projectRoot, 'package.json'), '{}')
    expect(() => resolveDepEntry({ dep: 'missing', projectRoot, workspaceRoot: root, kind: 'js' })).toThrow(/cannot locate package.json/)
  })

  it('throws when the dep lacks a JS entry field', () => {
    const { projectRoot } = seedDep('demo', { name: 'demo' })
    expect(() => resolveDepEntry({ dep: 'demo', projectRoot, workspaceRoot: root, kind: 'js' })).toThrow(/has no main\/module entry/)
  })

  it('throws when the dep lacks a dts entry field', () => {
    const { projectRoot } = seedDep('demo', { name: 'demo', main: 'dist/index.js' }, ['dist/index.js'])
    expect(() => resolveDepEntry({ dep: 'demo', projectRoot, workspaceRoot: root, kind: 'dts' })).toThrow(/has no types\/typings entry/)
  })

  it('falls back to entry-walk when the dep restricts ./package.json via exports', () => {
    const projectRoot = join(root, 'project')
    const depDir = join(projectRoot, 'node_modules', 'restricted')
    mkdirSync(depDir, { recursive: true })
    writeFileSync(
      join(depDir, 'package.json'),
      JSON.stringify({
        name: 'restricted',
        main: './dist/index.js',
        exports: { '.': './dist/index.js' },
      })
    )
    mkdirSync(join(depDir, 'dist'), { recursive: true })
    writeFileSync(join(depDir, 'dist', 'index.js'), '')
    mkdirSync(projectRoot, { recursive: true })
    writeFileSync(join(projectRoot, 'package.json'), '{}')
    const entry = resolveDepEntry({ dep: 'restricted', projectRoot, workspaceRoot: root, kind: 'js' })
    expect(entry.endsWith('dist/index.js')).toBe(true)
  })

  it('handles absolute entry paths in the dep package.json', () => {
    const absolutePath = join(root, 'absolute-entry.js')
    writeFileSync(absolutePath, '')
    const projectRoot = join(root, 'project')
    const depDir = join(projectRoot, 'node_modules', 'absdep')
    mkdirSync(depDir, { recursive: true })
    writeFileSync(join(depDir, 'package.json'), JSON.stringify({ name: 'absdep', main: absolutePath }))
    mkdirSync(projectRoot, { recursive: true })
    writeFileSync(join(projectRoot, 'package.json'), '{}')
    const entry = resolveDepEntry({ dep: 'absdep', projectRoot, workspaceRoot: root, kind: 'js' })
    expect(entry).toContain('absolute-entry.js')
  })
})
