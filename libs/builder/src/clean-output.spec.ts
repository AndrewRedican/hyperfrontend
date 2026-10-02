import type { BuildContext } from './models'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { assertOutputPathClearOfInputs, cleanOutputPath } from './clean-output'

const ctx = (outputPath: string, workspaceRoot: string, projectRoot = join(workspaceRoot, 'libs', 'foo')): BuildContext =>
  ({ outputPath, workspaceRoot, projectRoot, tsConfigPath: join(projectRoot, 'tsconfig.lib.json') }) as unknown as BuildContext

const writeManifest = (dir: string, name: string | null): void => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), name === null ? '{}' : `{ "name": "${name}" }`)
}

describe('cleanOutputPath', () => {
  let workspaceRoot: string
  let projectRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'builder-clean-'))
    projectRoot = join(workspaceRoot, 'libs', 'foo')
    writeManifest(projectRoot, '@scope/foo')
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it('removes a previous build of the package, leaving sibling projects intact', () => {
    const target = join(workspaceRoot, 'dist', 'libs', 'foo')
    const sibling = join(workspaceRoot, 'dist', 'libs', 'bar')
    writeManifest(target, '@scope/foo')
    writeFileSync(join(target, 'index.cjs.js.map'), '{}')
    writeManifest(sibling, '@scope/bar')
    cleanOutputPath(ctx(target, workspaceRoot))
    // why: the clean is scoped to one project, so a sibling library's output under the shared dist/ must survive.
    expect({ stale: existsSync(join(target, 'index.cjs.js.map')), sibling: existsSync(sibling) }).toEqual({ stale: false, sibling: true })
  })

  it('creates a missing output directory (e.g. the first build)', () => {
    const target = join(workspaceRoot, 'dist', 'libs', 'absent')
    cleanOutputPath(ctx(target, workspaceRoot))
    expect(existsSync(target)).toBe(true)
  })

  it('keeps an existing empty output directory', () => {
    const target = join(workspaceRoot, 'dist', 'libs', 'foo')
    mkdirSync(target, { recursive: true })
    expect(() => cleanOutputPath(ctx(target, workspaceRoot))).not.toThrow()
  })

  it('stamps the output with a manifest naming the package', () => {
    const target = join(workspaceRoot, 'dist', 'libs', 'foo')
    cleanOutputPath(ctx(target, workspaceRoot))
    expect(readFileSync(join(target, 'package.json'), 'utf-8')).toEqual(expect.stringContaining('"name": "@scope/foo"'))
  })

  it('recognises an output a previous build left before writing its real manifest', () => {
    const target = join(workspaceRoot, 'dist', 'libs', 'foo')
    cleanOutputPath(ctx(target, workspaceRoot))
    writeFileSync(join(target, 'index.esm.js'), 'partial')
    cleanOutputPath(ctx(target, workspaceRoot))
    expect(existsSync(join(target, 'index.esm.js'))).toBe(false)
  })

  it('skips the stamp when the project manifest names nothing', () => {
    writeManifest(projectRoot, null)
    const target = join(workspaceRoot, 'dist', 'libs', 'foo')
    cleanOutputPath(ctx(target, workspaceRoot))
    expect(existsSync(join(target, 'package.json'))).toBe(false)
  })

  it('cleans an output in a dist/ tree beside the workspace', () => {
    const target = join(`${workspaceRoot}-dist`, 'foo')
    writeManifest(target, '@scope/foo')
    writeFileSync(join(target, 'stale.js'), 'x')
    try {
      cleanOutputPath(ctx(target, workspaceRoot))
      expect(existsSync(join(target, 'stale.js'))).toBe(false)
    } finally {
      rmSync(`${workspaceRoot}-dist`, { recursive: true, force: true })
    }
  })

  it('cleans the bare dist/ of a standalone project that is its own workspace', () => {
    writeManifest(workspaceRoot, '@scope/foo')
    const target = join(workspaceRoot, 'dist')
    writeManifest(target, '@scope/foo')
    writeFileSync(join(target, 'stale.js'), 'x')
    cleanOutputPath(ctx(target, workspaceRoot, workspaceRoot))
    expect(existsSync(join(target, 'stale.js'))).toBe(false)
  })

  it('refuses a directory holding files no build of the package wrote', () => {
    const target = join(workspaceRoot, 'notes')
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, 'todo.md'), 'keep me')
    expect(() => cleanOutputPath(ctx(target, workspaceRoot))).toThrow(/did not write/)
  })

  it("refuses another package's output", () => {
    const target = join(workspaceRoot, 'dist', 'libs', 'bar')
    writeManifest(target, '@scope/bar')
    expect(() => cleanOutputPath(ctx(target, workspaceRoot))).toThrow(/did not write/)
  })

  it('refuses the shared dist/ root holding other projects', () => {
    writeManifest(join(workspaceRoot, 'dist', 'libs', 'bar'), '@scope/bar')
    expect(() => cleanOutputPath(ctx(join(workspaceRoot, 'dist'), workspaceRoot))).toThrow(/did not write/)
  })

  it('refuses the workspace root', () => {
    writeManifest(workspaceRoot, '@scope/source')
    expect(() => cleanOutputPath(ctx(workspaceRoot, workspaceRoot))).toThrow(/did not write/)
  })

  it('refuses an unrelated directory elsewhere on disk', () => {
    const elsewhere = mkdtempSync(join(tmpdir(), 'builder-elsewhere-'))
    writeFileSync(join(elsewhere, 'data.txt'), 'x')
    try {
      expect(() => cleanOutputPath(ctx(elsewhere, workspaceRoot))).toThrow(/did not write/)
    } finally {
      rmSync(elsewhere, { recursive: true, force: true })
    }
  })

  it('refuses the filesystem root', () => {
    expect(() => cleanOutputPath(ctx('/', workspaceRoot))).toThrow(/did not write/)
  })

  it('refuses a file in place of the output directory', () => {
    const target = join(workspaceRoot, 'out.txt')
    writeFileSync(target, 'x')
    expect(() => cleanOutputPath(ctx(target, workspaceRoot))).toThrow(/is a file/)
  })

  it('refuses a non-empty output when the project manifest names nothing', () => {
    writeManifest(projectRoot, null)
    const target = join(workspaceRoot, 'dist', 'libs', 'foo')
    writeManifest(target, '@scope/foo')
    expect(() => cleanOutputPath(ctx(target, workspaceRoot))).toThrow(/declares no name/)
  })

  it('names the package a cleanable output would belong to', () => {
    const target = join(workspaceRoot, 'dist', 'libs', 'bar')
    writeManifest(target, '@scope/bar')
    expect(() => cleanOutputPath(ctx(target, workspaceRoot))).toThrow('previous build of "@scope/foo"')
  })
})

describe('assertOutputPathClearOfInputs', () => {
  let workspaceRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'builder-inputs-'))
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it('accepts an output beside the project sources', () => {
    expect(() => assertOutputPathClearOfInputs(ctx(join(workspaceRoot, 'dist', 'libs', 'foo'), workspaceRoot))).not.toThrow()
  })

  it("accepts a standalone project's own dist/ directory", () => {
    expect(() => assertOutputPathClearOfInputs(ctx(join(workspaceRoot, 'dist'), workspaceRoot, workspaceRoot))).not.toThrow()
  })

  it('refuses the project root itself', () => {
    const projectRoot = join(workspaceRoot, 'libs', 'foo')
    expect(() => assertOutputPathClearOfInputs(ctx(projectRoot, workspaceRoot, projectRoot))).toThrow(/own input/)
  })

  it('refuses an ancestor of the project root', () => {
    expect(() => assertOutputPathClearOfInputs(ctx(join(workspaceRoot, 'libs'), workspaceRoot))).toThrow(/own input/)
  })

  it("refuses the project's src tree", () => {
    expect(() => assertOutputPathClearOfInputs(ctx(join(workspaceRoot, 'libs', 'foo', 'src'), workspaceRoot))).toThrow(/own input/)
  })

  it("refuses a directory inside the project's src tree", () => {
    const target = join(workspaceRoot, 'libs', 'foo', 'src', 'generated')
    mkdirSync(target, { recursive: true })
    expect(() => assertOutputPathClearOfInputs(ctx(target, workspaceRoot))).toThrow(/own input/)
  })

  it('refuses a directory holding the tsconfig the build reads', () => {
    const configs = join(workspaceRoot, 'configs')
    const context = { ...ctx(configs, workspaceRoot), tsConfigPath: join(configs, 'tsconfig.lib.json') } as BuildContext
    expect(() => assertOutputPathClearOfInputs(context)).toThrow(/own input/)
  })

  it('names the input the output would overlap', () => {
    expect(() => assertOutputPathClearOfInputs(ctx(join(workspaceRoot, 'libs'), workspaceRoot))).toThrow(
      join(workspaceRoot, 'libs', 'foo', 'src')
    )
  })
})
