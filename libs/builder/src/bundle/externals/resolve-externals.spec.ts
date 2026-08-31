import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { resolveExternals } from './resolve-externals'

const writePkg = (root: string, contents: object): string => {
  const path = join(root, 'package.json')
  writeFileSync(path, JSON.stringify(contents))
  return path
}

const isHyperfrontend = (name: string): boolean => name.startsWith('@hyperfrontend/')

describe('resolveExternals', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-externals-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('returns an empty list when package.json is missing', () => {
    expect(resolveExternals({ packageJsonPath: join(root, 'missing.json') })).toEqual([])
  })

  it('marks all dependencies and peer dependencies external by default', () => {
    const path = writePkg(root, { dependencies: { lodash: '*', react: '*' }, peerDependencies: { 'react-dom': '*' } })
    expect(resolveExternals({ packageJsonPath: path })).toEqual(expect.arrayContaining(['lodash', 'react', 'react-dom']))
  })

  it('keeps workspace packages external when bundleWorkspaceDeps is false', () => {
    const path = writePkg(root, { dependencies: { '@hyperfrontend/logging': '*', lodash: '*' } })
    expect(resolveExternals({ packageJsonPath: path, isWorkspacePackage: isHyperfrontend, bundleWorkspaceDeps: false })).toEqual(
      expect.arrayContaining(['@hyperfrontend/logging', 'lodash'])
    )
  })

  it('strips workspace dependencies from the external list when bundleWorkspaceDeps is true', () => {
    const path = writePkg(root, { dependencies: { '@hyperfrontend/logging': '*', lodash: '*' } })
    expect(resolveExternals({ packageJsonPath: path, isWorkspacePackage: isHyperfrontend, bundleWorkspaceDeps: true })).not.toContain(
      '@hyperfrontend/logging'
    )
  })

  it('preserves peer dependencies even when they match the workspace predicate and bundleWorkspaceDeps is true', () => {
    const path = writePkg(root, { peerDependencies: { '@hyperfrontend/logging': '*' } })
    expect(resolveExternals({ packageJsonPath: path, isWorkspacePackage: isHyperfrontend, bundleWorkspaceDeps: true })).toContain(
      '@hyperfrontend/logging'
    )
  })

  it('appends additional package names to the external list', () => {
    const path = writePkg(root, {})
    expect(resolveExternals({ packageJsonPath: path, additional: ['react'] })).toEqual(['react'])
  })

  it('strips workspace entries from additional when bundleWorkspaceDeps is true', () => {
    const path = writePkg(root, {})
    expect(
      resolveExternals({
        packageJsonPath: path,
        additional: ['@hyperfrontend/logging', 'lodash'],
        isWorkspacePackage: isHyperfrontend,
        bundleWorkspaceDeps: true,
      })
    ).toEqual(['lodash'])
  })

  it('de-duplicates packages that appear in dependencies, peer dependencies, and additional', () => {
    const path = writePkg(root, { dependencies: { react: '*' }, peerDependencies: { react: '*' } })
    const result = resolveExternals({ packageJsonPath: path, additional: ['react'] })
    expect(result.filter((name) => name === 'react')).toHaveLength(1)
  })

  it('strips bundled deps from the resolved external list', () => {
    const path = writePkg(root, { dependencies: { rollup: '*', lodash: '*' } })
    const result = resolveExternals({ packageJsonPath: path, bundledDeps: ['rollup'] })
    expect(result).toContain('lodash')
    expect(result).not.toContain('rollup')
  })

  it('strips bundled deps even when also listed in additional', () => {
    const path = writePkg(root, {})
    const result = resolveExternals({ packageJsonPath: path, additional: ['rollup', 'lodash'], bundledDeps: ['rollup'] })
    expect(result).toEqual(['lodash'])
  })

  it('strips workspace bundled deps from the resolved external list', () => {
    const path = writePkg(root, { dependencies: { '@hyperfrontend/logging': '*', rollup: '*' } })
    const result = resolveExternals({
      packageJsonPath: path,
      isWorkspacePackage: (n) => n.startsWith('@hyperfrontend/'),
      workspaceBundledDepNames: ['@hyperfrontend/logging'],
    })
    expect(result).toContain('rollup')
    expect(result).not.toContain('@hyperfrontend/logging')
  })

  it('strips workspace bundled deps even when also listed in additional', () => {
    const path = writePkg(root, {})
    const result = resolveExternals({
      packageJsonPath: path,
      additional: ['@hyperfrontend/logging', 'lodash'],
      isWorkspacePackage: (n) => n.startsWith('@hyperfrontend/'),
      workspaceBundledDepNames: ['@hyperfrontend/logging'],
    })
    expect(result).toEqual(['lodash'])
  })
})
