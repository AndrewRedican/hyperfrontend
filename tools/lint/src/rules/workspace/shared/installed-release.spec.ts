import { existsSync } from 'node:fs'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { installedRelease } from './installed-release.ts'

/**
 * A lock whose installed packages are the given entries.
 *
 * @param packages - The entries by install path
 * @returns The file text
 */
const lock = (packages: Record<string, unknown>): string => `${stringify({ packages })}\n`

const projects = createTempDir({
  prefix: 'lint-installed-release-',
  tree: {
    'registry/package-lock.json': lock({
      'node_modules/@scope/kit': { version: '1.2.3', resolved: 'https://registry.npmjs.org/@scope/kit/-/kit-1.2.3.tgz' },
    }),
    'vendored/package-lock.json': lock({ 'node_modules/@scope/kit': { version: '1.2.3', resolved: 'file:../vendor/kit-1.2.3.tgz' } }),
    'linked/package-lock.json': lock({ 'node_modules/@scope/kit': { resolved: 'libs/kit', link: true } }),
    'unresolved/package-lock.json': lock({ 'node_modules/@scope/kit': { version: '1.2.3' } }),
    'without/package-lock.json': lock({ '': {} }),
    'empty/package-lock.json': '{}\n',
    'unparsable/package-lock.json': '{ "packages": ',
    'lockless/package.json': '{}\n',
  },
})

describe('installedRelease', () => {
  it('names the version a lock installs from the registry', () => {
    expect(installedRelease(projects.resolve('registry'), '@scope/kit')).toBe('1.2.3')
  })

  it('finds no release of a package the lock does not name', () => {
    expect(installedRelease(projects.resolve('registry'), '@scope/other')).toBeNull()
  })

  it.each(['vendored', 'linked', 'unresolved', 'without', 'empty', 'unparsable', 'lockless'])(
    'finds no release in the %s project',
    (project) => {
      expect(installedRelease(projects.resolve(project), '@scope/kit')).toBeNull()
    }
  )
})

describe('the disposable projects', () => {
  it('are removed once the cases have run', () => {
    projects.remove()
    expect(existsSync(projects.path)).toBe(false)
  })
})
