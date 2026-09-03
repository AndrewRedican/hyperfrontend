import type { BuildContext } from './models'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { cleanOutputPath } from './clean-output'

const ctx = (outputPath: string, workspaceRoot: string): BuildContext => ({ outputPath, workspaceRoot }) as unknown as BuildContext

describe('cleanOutputPath', () => {
  let workspaceRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'builder-clean-'))
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  it('removes the project output subtree, leaving sibling projects intact', () => {
    const target = join(workspaceRoot, 'dist', 'libs', 'foo')
    const sibling = join(workspaceRoot, 'dist', 'libs', 'bar')
    mkdirSync(target, { recursive: true })
    mkdirSync(sibling, { recursive: true })
    writeFileSync(join(target, 'index.cjs.js.map'), '{}')
    writeFileSync(join(sibling, 'index.cjs.js'), 'x')
    cleanOutputPath(ctx(target, workspaceRoot))
    expect(existsSync(target)).toBe(false)
    // why: the clean is scoped to one project, so a sibling library's output under the shared dist/ must survive.
    expect(existsSync(sibling)).toBe(true)
  })

  it('is a no-op when outputPath does not exist (e.g. the first build)', () => {
    const target = join(workspaceRoot, 'dist', 'libs', 'absent')
    expect(() => cleanOutputPath(ctx(target, workspaceRoot))).not.toThrow()
  })

  it('cleans a custom in-workspace outputPath outside dist/', () => {
    const target = join(workspaceRoot, 'build', 'libs', 'foo')
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, 'stale.js'), 'x')
    cleanOutputPath(ctx(target, workspaceRoot))
    expect(existsSync(target)).toBe(false)
  })

  it('refuses to clean the bare dist/ root', () => {
    expect(() => cleanOutputPath(ctx(join(workspaceRoot, 'dist'), workspaceRoot))).toThrow(/refusing to clean/)
  })

  it('refuses to clean the workspace root itself', () => {
    expect(() => cleanOutputPath(ctx(workspaceRoot, workspaceRoot))).toThrow(/refusing to clean/)
  })

  it('refuses to clean an ancestor of the workspace root', () => {
    expect(() => cleanOutputPath(ctx(join(workspaceRoot, '..'), workspaceRoot))).toThrow(/refusing to clean/)
  })

  it('refuses to clean a path outside the workspace', () => {
    expect(() => cleanOutputPath(ctx('/', workspaceRoot))).toThrow(/refusing to clean/)
  })
})
