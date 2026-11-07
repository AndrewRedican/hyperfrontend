import { readFileSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { tarballStem, updateE2eDependencies } from './update-e2e-dependencies'

const workspace = useTempDir({
  tree: {
    'e2e/core/package.json': JSON.stringify({ name: 'e2e-core', dependencies: { '@scope/core': 'file:../../packs/scope-core-1.0.0.tgz' } }),
    'e2e/pinned/package.json': JSON.stringify({ name: 'e2e-pinned', dependencies: { '@scope/core': '1.0.0' } }),
    'e2e/current/package.json': JSON.stringify({
      name: 'e2e-current',
      dependencies: { '@scope/core': 'file:../../packs/scope-core-1.1.0.tgz' },
    }),
    'e2e/flat/package.json': JSON.stringify({ name: 'e2e-flat', dependencies: { '@scope/core': 'file:scope-core-1.0.0.tgz' } }),
    'e2e/foreign/package.json': JSON.stringify({
      name: 'e2e-foreign',
      dependencies: { '@scope/core': 'file:../../packs/other-1.0.0.tgz' },
    }),
    'e2e/tar/package.json': JSON.stringify({ name: 'e2e-tar', dependencies: { '@scope/core': 'file:../../packs/scope-core-1.0.0.tar' } }),
    'e2e/none/package.json': JSON.stringify({ name: 'e2e-none', dependencies: { other: '1.0.0' } }),
  },
})

/**
 * Reads the pin an e2e manifest holds on the core package.
 *
 * @param relativePath - The manifest, workspace-relative
 * @returns The dependency value the manifest holds for the package
 */
function pinOf(relativePath: string): string | undefined {
  return (JSON.parse(readFileSync(workspace.resolve(relativePath), 'utf8')) as { dependencies: Record<string, string> }).dependencies[
    '@scope/core'
  ]
}

describe('tarballStem', () => {
  it('joins the scope and the name of a scoped package', () => {
    expect(tarballStem('@scope/core')).toBe('scope-core')
  })

  it('keeps the name of an unscoped package', () => {
    expect(tarballStem('core')).toBe('core')
  })
})

describe('updateE2eDependencies', () => {
  it('renames the tarball the dependents pin, and names their manifests', () => {
    const files = updateE2eDependencies('@scope/core', '1.1.0', workspace.path, [{ root: 'e2e/core' }], false)
    expect({ files, pin: pinOf('e2e/core/package.json') }).toEqual({
      files: ['e2e/core/package.json'],
      pin: 'file:../../packs/scope-core-1.1.0.tgz',
    })
  })

  it('renames a tarball pinned without a directory', () => {
    const files = updateE2eDependencies('@scope/core', '1.1.0', workspace.path, [{ root: 'e2e/flat' }], false)
    expect({ files, pin: pinOf('e2e/flat/package.json') }).toEqual({ files: ['e2e/flat/package.json'], pin: 'file:scope-core-1.1.0.tgz' })
  })

  it('leaves a dependent whose pin is not this package tarball at an older version, and one without a manifest', () => {
    expect(
      updateE2eDependencies(
        '@scope/core',
        '1.1.0',
        workspace.path,
        [
          { root: 'e2e/pinned' },
          { root: 'e2e/current' },
          { root: 'e2e/foreign' },
          { root: 'e2e/tar' },
          { root: 'e2e/none' },
          { root: 'e2e/absent' },
        ],
        false
      )
    ).toEqual([])
  })

  it('answers nothing when no project depends on the package', () => {
    expect(updateE2eDependencies('@scope/core', '1.1.0', workspace.path, [], false)).toEqual([])
  })

  it('writes nothing on a dry run and still names what it would change', () => {
    expect({
      files: updateE2eDependencies('@scope/core', '1.1.0', workspace.path, [{ root: 'e2e/core' }], true),
      pin: pinOf('e2e/core/package.json'),
    }).toEqual({ files: ['e2e/core/package.json'], pin: 'file:../../packs/scope-core-1.0.0.tgz' })
  })

  it('answers nothing when the dependents cannot be read', () => {
    expect(updateE2eDependencies('@scope/core', '1.1.0', workspace.path, null as unknown as [], false)).toEqual([])
  })
})
