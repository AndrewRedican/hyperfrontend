import type { BuildContext } from './models'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir, useTempDir } from '@hyperfrontend/testing/fs'
import { assertOutputPathClearOfInputs, cleanOutputPath } from './clean-output'

const ctx = (outputPath: string, workspaceRoot: string, projectRoot = join(workspaceRoot, 'libs', 'foo')): BuildContext =>
  ({ outputPath, workspaceRoot, projectRoot, tsConfigPath: join(projectRoot, 'tsconfig.lib.json') }) as unknown as BuildContext

const writeManifest = (dir: string, name: string | null): void => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), name === null ? '{}' : `{ "name": "${name}" }`)
}

describe('cleanOutputPath', () => {
  const workspace = useTempDir({ prefix: 'builder-clean-' })
  let projectRoot: string

  beforeEach(() => {
    projectRoot = workspace.resolve('libs', 'foo')
    writeManifest(projectRoot, '@scope/foo')
  })

  it('removes a previous build of the package, leaving sibling projects intact', () => {
    const target = workspace.resolve('dist', 'libs', 'foo')
    const sibling = workspace.resolve('dist', 'libs', 'bar')
    writeManifest(target, '@scope/foo')
    writeFileSync(join(target, 'index.cjs.map'), '{}')
    writeManifest(sibling, '@scope/bar')
    cleanOutputPath(ctx(target, workspace.path))
    // why: the clean is scoped to one project, so a sibling library's output under the shared dist/ must survive.
    expect({ stale: existsSync(join(target, 'index.cjs.map')), sibling: existsSync(sibling) }).toEqual({ stale: false, sibling: true })
  })

  it('creates a missing output directory (e.g. the first build)', () => {
    const target = workspace.resolve('dist', 'libs', 'absent')
    cleanOutputPath(ctx(target, workspace.path))
    expect(existsSync(target)).toBe(true)
  })

  it('keeps an existing empty output directory', () => {
    const target = workspace.resolve('dist', 'libs', 'foo')
    mkdirSync(target, { recursive: true })
    expect(() => cleanOutputPath(ctx(target, workspace.path))).not.toThrow()
  })

  it('stamps the output with a manifest naming the package', () => {
    const target = workspace.resolve('dist', 'libs', 'foo')
    cleanOutputPath(ctx(target, workspace.path))
    expect(readFileSync(join(target, 'package.json'), 'utf-8')).toEqual(expect.stringContaining('"name": "@scope/foo"'))
  })

  it('recognises an output a previous build left before writing its real manifest', () => {
    const target = workspace.resolve('dist', 'libs', 'foo')
    cleanOutputPath(ctx(target, workspace.path))
    writeFileSync(join(target, 'index.mjs'), 'partial')
    cleanOutputPath(ctx(target, workspace.path))
    expect(existsSync(join(target, 'index.mjs'))).toBe(false)
  })

  it('skips the stamp when the project manifest names nothing', () => {
    writeManifest(projectRoot, null)
    const target = workspace.resolve('dist', 'libs', 'foo')
    cleanOutputPath(ctx(target, workspace.path))
    expect(existsSync(join(target, 'package.json'))).toBe(false)
  })

  it('cleans an output in a dist/ tree beside the workspace', () => {
    const target = join(`${workspace.path}-dist`, 'foo')
    writeManifest(target, '@scope/foo')
    writeFileSync(join(target, 'stale.js'), 'x')
    try {
      cleanOutputPath(ctx(target, workspace.path))
      expect(existsSync(join(target, 'stale.js'))).toBe(false)
    } finally {
      rmSync(`${workspace.path}-dist`, { recursive: true, force: true })
    }
  })

  it('cleans the bare dist/ of a standalone project that is its own workspace', () => {
    writeManifest(workspace.path, '@scope/foo')
    const target = workspace.resolve('dist')
    writeManifest(target, '@scope/foo')
    writeFileSync(join(target, 'stale.js'), 'x')
    cleanOutputPath(ctx(target, workspace.path, workspace.path))
    expect(existsSync(join(target, 'stale.js'))).toBe(false)
  })

  it('refuses a directory holding files no build of the package wrote', () => {
    const target = workspace.resolve('notes')
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, 'todo.md'), 'keep me')
    expect(() => cleanOutputPath(ctx(target, workspace.path))).toThrow(/did not write/)
  })

  it("refuses another package's output", () => {
    const target = workspace.resolve('dist', 'libs', 'bar')
    writeManifest(target, '@scope/bar')
    expect(() => cleanOutputPath(ctx(target, workspace.path))).toThrow(/did not write/)
  })

  it('refuses the shared dist/ root holding other projects', () => {
    writeManifest(workspace.resolve('dist', 'libs', 'bar'), '@scope/bar')
    expect(() => cleanOutputPath(ctx(workspace.resolve('dist'), workspace.path))).toThrow(/did not write/)
  })

  it('refuses the workspace root', () => {
    writeManifest(workspace.path, '@scope/source')
    expect(() => cleanOutputPath(ctx(workspace.path, workspace.path))).toThrow(/did not write/)
  })

  it('refuses an unrelated directory elsewhere on disk', () => {
    const elsewhere = createTempDir({ prefix: 'builder-elsewhere-', tree: { 'data.txt': 'x' } })
    try {
      expect(() => cleanOutputPath(ctx(elsewhere.path, workspace.path))).toThrow(/did not write/)
    } finally {
      elsewhere.remove()
    }
  })

  it('refuses the filesystem root', () => {
    expect(() => cleanOutputPath(ctx('/', workspace.path))).toThrow(/did not write/)
  })

  it('refuses a file in place of the output directory', () => {
    const target = workspace.resolve('out.txt')
    writeFileSync(target, 'x')
    expect(() => cleanOutputPath(ctx(target, workspace.path))).toThrow(/is a file/)
  })

  it('refuses a non-empty output when the project manifest names nothing', () => {
    writeManifest(projectRoot, null)
    const target = workspace.resolve('dist', 'libs', 'foo')
    writeManifest(target, '@scope/foo')
    expect(() => cleanOutputPath(ctx(target, workspace.path))).toThrow(/declares no name/)
  })

  it('names the package a cleanable output would belong to', () => {
    const target = workspace.resolve('dist', 'libs', 'bar')
    writeManifest(target, '@scope/bar')
    expect(() => cleanOutputPath(ctx(target, workspace.path))).toThrow('previous build of "@scope/foo"')
  })
})

describe('assertOutputPathClearOfInputs', () => {
  const workspace = useTempDir({ prefix: 'builder-inputs-' })

  it('accepts an output beside the project sources', () => {
    expect(() => assertOutputPathClearOfInputs(ctx(workspace.resolve('dist', 'libs', 'foo'), workspace.path))).not.toThrow()
  })

  it("accepts a standalone project's own dist/ directory", () => {
    expect(() => assertOutputPathClearOfInputs(ctx(workspace.resolve('dist'), workspace.path, workspace.path))).not.toThrow()
  })

  it('refuses the project root itself', () => {
    const projectRoot = workspace.resolve('libs', 'foo')
    expect(() => assertOutputPathClearOfInputs(ctx(projectRoot, workspace.path, projectRoot))).toThrow(/own input/)
  })

  it('refuses an ancestor of the project root', () => {
    expect(() => assertOutputPathClearOfInputs(ctx(workspace.resolve('libs'), workspace.path))).toThrow(/own input/)
  })

  it("refuses the project's src tree", () => {
    expect(() => assertOutputPathClearOfInputs(ctx(workspace.resolve('libs', 'foo', 'src'), workspace.path))).toThrow(/own input/)
  })

  it("refuses a directory inside the project's src tree", () => {
    const target = workspace.resolve('libs', 'foo', 'src', 'generated')
    mkdirSync(target, { recursive: true })
    expect(() => assertOutputPathClearOfInputs(ctx(target, workspace.path))).toThrow(/own input/)
  })

  it('refuses a directory holding the tsconfig the build reads', () => {
    const configs = workspace.resolve('configs')
    const context = { ...ctx(configs, workspace.path), tsConfigPath: join(configs, 'tsconfig.lib.json') } as BuildContext
    expect(() => assertOutputPathClearOfInputs(context)).toThrow(/own input/)
  })

  it('names the input the output would overlap', () => {
    expect(() => assertOutputPathClearOfInputs(ctx(workspace.resolve('libs'), workspace.path))).toThrow(
      workspace.resolve('libs', 'foo', 'src')
    )
  })
})
