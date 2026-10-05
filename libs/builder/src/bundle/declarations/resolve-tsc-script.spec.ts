import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { resolveTscScript } from './resolve-tsc-script'

let workspaceRoot: string

const installTypescript = (root: string): string => {
  const binDir = join(root, 'node_modules', 'typescript', 'bin')
  mkdirSync(binDir, { recursive: true })
  writeFileSync(join(root, 'node_modules', 'typescript', 'package.json'), JSON.stringify({ name: 'typescript', version: '0.0.0' }))
  writeFileSync(join(binDir, 'tsc'), '')
  return join(binDir, 'tsc')
}

beforeEach(() => {
  workspaceRoot = realpathSync(mkdtempSync(join(tmpdir(), 'resolve-tsc-script-')))
})

afterEach(() => {
  rmSync(workspaceRoot, { recursive: true, force: true })
})

describe('resolveTscScript', () => {
  it('resolves the tsc entry script of the typescript installed at the workspace root', () => {
    writeFileSync(join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'workspace' }))
    const tscScript = installTypescript(workspaceRoot)
    expect(resolveTscScript(workspaceRoot)).toBe(tscScript)
  })

  it('resolves the script itself rather than the node_modules/.bin launcher', () => {
    installTypescript(workspaceRoot)
    mkdirSync(join(workspaceRoot, 'node_modules', '.bin'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'node_modules', '.bin', 'tsc'), '')
    expect(resolveTscScript(workspaceRoot)).not.toContain('.bin')
  })

  it('resolves when the workspace root has no package.json', () => {
    const tscScript = installTypescript(workspaceRoot)
    expect(resolveTscScript(workspaceRoot)).toBe(tscScript)
  })

  it('resolves a typescript hoisted above a nested workspace root', () => {
    const tscScript = installTypescript(workspaceRoot)
    const nested = join(workspaceRoot, 'packages', 'app')
    mkdirSync(nested, { recursive: true })
    expect(resolveTscScript(nested)).toBe(tscScript)
  })

  it('resolves a workspace root whose path contains spaces', () => {
    const spaced = join(workspaceRoot, 'Jane Doe', 'repo')
    mkdirSync(spaced, { recursive: true })
    const tscScript = installTypescript(spaced)
    expect(resolveTscScript(spaced)).toBe(tscScript)
  })

  it('throws when typescript is not installed in the workspace', () => {
    const isolated = join(workspaceRoot, 'empty')
    mkdirSync(isolated, { recursive: true })
    expect(() => resolveTscScript(isolated)).toThrow(/typescript\/bin\/tsc/)
  })
})
