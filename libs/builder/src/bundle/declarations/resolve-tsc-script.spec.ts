import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { resolveTscScript } from './resolve-tsc-script'

describe('resolveTscScript', () => {
  const workspace = useTempDir({ prefix: 'resolve-tsc-script-' })

  const installTypescript = (relativeRoot = ''): string => {
    workspace.write(join(relativeRoot, 'node_modules/typescript/package.json'), { name: 'typescript', version: '0.0.0' })
    return workspace.write(join(relativeRoot, 'node_modules/typescript/bin/tsc'), '')
  }

  it('resolves the tsc entry script of the typescript installed at the workspace root', () => {
    workspace.write('package.json', { name: 'workspace' })
    const tscScript = installTypescript()
    expect(resolveTscScript(workspace.path)).toBe(tscScript)
  })

  it('resolves the script itself rather than the node_modules/.bin launcher', () => {
    installTypescript()
    workspace.write('node_modules/.bin/tsc', '')
    expect(resolveTscScript(workspace.path)).not.toContain('.bin')
  })

  it('resolves when the workspace root has no package.json', () => {
    const tscScript = installTypescript()
    expect(resolveTscScript(workspace.path)).toBe(tscScript)
  })

  it('resolves a typescript hoisted above a nested workspace root', () => {
    const tscScript = installTypescript()
    const nested = workspace.mkdir('packages/app')
    expect(resolveTscScript(nested)).toBe(tscScript)
  })

  it('resolves a workspace root whose path contains spaces', () => {
    const spaced = workspace.mkdir('Jane Doe/repo')
    const tscScript = installTypescript('Jane Doe/repo')
    expect(resolveTscScript(spaced)).toBe(tscScript)
  })

  it('throws when typescript is not installed in the workspace', () => {
    const isolated = workspace.mkdir('empty')
    expect(() => resolveTscScript(isolated)).toThrow(/typescript\/bin\/tsc/)
  })
})
