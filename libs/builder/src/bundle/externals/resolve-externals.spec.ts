import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { resolveExternals } from './resolve-externals'

const isHyperfrontend = (name: string): boolean => name.startsWith('@hyperfrontend/')

describe('resolveExternals', () => {
  const dir = useTempDir({ prefix: 'builder-externals-' })

  it('returns an empty list when package.json is missing', () => {
    expect(resolveExternals({ packageJsonPath: dir.resolve('missing.json') })).toEqual([])
  })

  it('marks all dependencies and peer dependencies external by default', () => {
    const path = dir.write('package.json', { dependencies: { lodash: '*', react: '*' }, peerDependencies: { 'react-dom': '*' } })
    expect(resolveExternals({ packageJsonPath: path })).toEqual(expect.arrayContaining(['lodash', 'react', 'react-dom']))
  })

  it('keeps workspace packages external when bundleWorkspaceDeps is false', () => {
    const path = dir.write('package.json', { dependencies: { '@hyperfrontend/logging': '*', lodash: '*' } })
    expect(resolveExternals({ packageJsonPath: path, isWorkspacePackage: isHyperfrontend, bundleWorkspaceDeps: false })).toEqual(
      expect.arrayContaining(['@hyperfrontend/logging', 'lodash'])
    )
  })

  it('strips workspace dependencies from the external list when bundleWorkspaceDeps is true', () => {
    const path = dir.write('package.json', { dependencies: { '@hyperfrontend/logging': '*', lodash: '*' } })
    expect(resolveExternals({ packageJsonPath: path, isWorkspacePackage: isHyperfrontend, bundleWorkspaceDeps: true })).not.toContain(
      '@hyperfrontend/logging'
    )
  })

  it('preserves peer dependencies even when they match the workspace predicate and bundleWorkspaceDeps is true', () => {
    const path = dir.write('package.json', { peerDependencies: { '@hyperfrontend/logging': '*' } })
    expect(resolveExternals({ packageJsonPath: path, isWorkspacePackage: isHyperfrontend, bundleWorkspaceDeps: true })).toContain(
      '@hyperfrontend/logging'
    )
  })

  it('appends additional package names to the external list', () => {
    const path = dir.write('package.json', {})
    expect(resolveExternals({ packageJsonPath: path, additional: ['react'] })).toEqual(['react'])
  })

  it('strips workspace entries from additional when bundleWorkspaceDeps is true', () => {
    const path = dir.write('package.json', {})
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
    const path = dir.write('package.json', { dependencies: { react: '*' }, peerDependencies: { react: '*' } })
    const result = resolveExternals({ packageJsonPath: path, additional: ['react'] })
    expect(result.filter((name) => name === 'react')).toHaveLength(1)
  })

  it('strips bundled deps from the resolved external list', () => {
    const path = dir.write('package.json', { dependencies: { rollup: '*', lodash: '*' } })
    expect(resolveExternals({ packageJsonPath: path, bundledDeps: ['rollup'] })).toEqual(['lodash'])
  })

  it('strips bundled deps even when also listed in additional', () => {
    const path = dir.write('package.json', {})
    const result = resolveExternals({ packageJsonPath: path, additional: ['rollup', 'lodash'], bundledDeps: ['rollup'] })
    expect(result).toEqual(['lodash'])
  })

  it('strips workspace bundled deps from the resolved external list', () => {
    const path = dir.write('package.json', { dependencies: { '@hyperfrontend/logging': '*', rollup: '*' } })
    expect(
      resolveExternals({
        packageJsonPath: path,
        isWorkspacePackage: (n) => n.startsWith('@hyperfrontend/'),
        workspaceBundledDepNames: ['@hyperfrontend/logging'],
      })
    ).toEqual(['rollup'])
  })

  it('strips workspace bundled deps even when also listed in additional', () => {
    const path = dir.write('package.json', {})
    const result = resolveExternals({
      packageJsonPath: path,
      additional: ['@hyperfrontend/logging', 'lodash'],
      isWorkspacePackage: (n) => n.startsWith('@hyperfrontend/'),
      workspaceBundledDepNames: ['@hyperfrontend/logging'],
    })
    expect(result).toEqual(['lodash'])
  })
})
