import { readFileSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { replaceDependencyVersion, replaceTgzReference } from './replace-dependency-version'

const dir = useTempDir()

/**
 * Writes a manifest and returns its path.
 *
 * @param manifest - The manifest's content
 * @returns The absolute path of the file
 */
function manifest(manifest: Record<string, unknown>): string {
  return dir.write('package.json', JSON.stringify(manifest, null, 2) + '\n')
}

/**
 * Reads a manifest back.
 *
 * @param path - The absolute path of the file
 * @returns The parsed manifest
 */
function read(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

describe('replaceDependencyVersion', () => {
  it('brings every section that pins the package to the version, keeping the key order', () => {
    const path = manifest({
      name: 'a',
      dependencies: { x: '1.0.0', y: '1.0.0' },
      devDependencies: { x: '1.0.0' },
      peerDependencies: { x: '^1' },
    })
    expect({ changed: replaceDependencyVersion(path, 'x', '2.0.0'), manifest: read(path) }).toEqual({
      changed: true,
      manifest: { name: 'a', dependencies: { x: '2.0.0', y: '1.0.0' }, devDependencies: { x: '2.0.0' }, peerDependencies: { x: '2.0.0' } },
    })
  })

  it('leaves a manifest that does not pin the package, or pins it at the version already', () => {
    const path = manifest({ name: 'a', dependencies: { x: '2.0.0' }, optionalDependencies: { y: '1.0.0' } })
    const before = readFileSync(path, 'utf8')
    expect({ changed: replaceDependencyVersion(path, 'x', '2.0.0'), content: readFileSync(path, 'utf8') }).toEqual({
      changed: false,
      content: before,
    })
  })
})

describe('replaceTgzReference', () => {
  it('renames the tarball a file: pin names', () => {
    const path = manifest({ name: 'e2e', dependencies: { '@scope/core': 'file:../../packs/scope-core-1.0.0.tgz' } })
    expect({ changed: replaceTgzReference(path, '@scope/core', 'scope-core-', 'scope-core-1.1.0.tgz'), manifest: read(path) }).toEqual({
      changed: true,
      manifest: { name: 'e2e', dependencies: { '@scope/core': 'file:../../packs/scope-core-1.1.0.tgz' } },
    })
  })

  it('renames a tarball pinned without a directory', () => {
    const path = manifest({ name: 'e2e', devDependencies: { '@scope/core': 'file:scope-core-1.0.0.tgz' } })
    replaceTgzReference(path, '@scope/core', 'scope-core-', 'scope-core-1.1.0.tgz')
    expect(read(path)).toEqual({ name: 'e2e', devDependencies: { '@scope/core': 'file:scope-core-1.1.0.tgz' } })
  })

  it('leaves a pin that is not a tarball, and one that names the tarball already', () => {
    const path = manifest({
      name: 'e2e',
      dependencies: { '@scope/core': '1.0.0' },
      devDependencies: { '@scope/core': 'file:../packs/scope-core-1.1.0.tgz' },
    })
    const before = readFileSync(path, 'utf8')
    expect({
      changed: replaceTgzReference(path, '@scope/core', 'scope-core-', 'scope-core-1.1.0.tgz'),
      content: readFileSync(path, 'utf8'),
    }).toEqual({ changed: false, content: before })
  })
})
