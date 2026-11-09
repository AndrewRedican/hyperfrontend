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

  /**
   * A directory standing in for the builder's own, with nothing resolvable above it but the workspace.
   *
   * @returns The directory, created inside the temporary workspace.
   */
  const isolated = (): string => workspace.mkdir('elsewhere/builder')

  it('resolves the tsc entry script of the typescript installed at the workspace root', () => {
    workspace.write('package.json', { name: 'workspace' })
    const tscScript = installTypescript()
    expect(resolveTscScript(workspace.path, isolated())).toBe(tscScript)
  })

  it('resolves the typescript beside the builder before the one at the workspace root', () => {
    installTypescript()
    const own = installTypescript('node_modules/@hyperfrontend/builder')
    expect(resolveTscScript(workspace.path, workspace.mkdir('node_modules/@hyperfrontend/builder/bundle'))).toBe(own)
  })

  it('falls back to the workspace when the typescript above the builder exports no tsc script', () => {
    const tscScript = installTypescript('consumer')
    workspace.write('node_modules/typescript/package.json', { name: 'typescript', version: '7.0.0', exports: { '.': './index.js' } })
    workspace.write('node_modules/typescript/index.js', '')
    expect(resolveTscScript(join(workspace.path, 'consumer'), workspace.mkdir('node_modules/@hyperfrontend/builder/bundle'))).toBe(
      tscScript
    )
  })

  it('climbs from this module when no directory is given', () => {
    expect(resolveTscScript(isolated())).toMatch(/typescript[\\/]bin[\\/]tsc$/)
  })

  it('resolves the script itself rather than the node_modules/.bin launcher', () => {
    installTypescript()
    workspace.write('node_modules/.bin/tsc', '')
    expect(resolveTscScript(workspace.path, isolated())).not.toContain('.bin')
  })

  it('resolves when the workspace root has no package.json', () => {
    const tscScript = installTypescript()
    expect(resolveTscScript(workspace.path, isolated())).toBe(tscScript)
  })

  it('resolves a typescript hoisted above a nested workspace root', () => {
    const tscScript = installTypescript()
    const nested = workspace.mkdir('packages/app')
    expect(resolveTscScript(nested, isolated())).toBe(tscScript)
  })

  it('resolves a workspace root whose path contains spaces', () => {
    const spaced = workspace.mkdir('Jane Doe/repo')
    const tscScript = installTypescript('Jane Doe/repo')
    expect(resolveTscScript(spaced, isolated())).toBe(tscScript)
  })

  it('throws when typescript is installed neither beside the builder nor in the workspace', () => {
    const empty = workspace.mkdir('empty')
    expect(() => resolveTscScript(empty, isolated())).toThrow(/typescript\/bin\/tsc .* TypeScript 7 ships no tsc script/)
  })
})
