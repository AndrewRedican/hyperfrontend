import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { isPlatformRestrictedDep } from './platform-restricted'

describe('isPlatformRestrictedDep', () => {
  const dir = useTempDir({
    scope: 'all',
    tree: {
      'node_modules/fsevents/package.json': { name: 'fsevents', os: ['darwin'] },
      'node_modules/@scope/native/package.json': { name: '@scope/native', cpu: ['x64'] },
      'node_modules/unrestricted/package.json': { name: 'unrestricted', os: [], cpu: [] },
      'node_modules/plain/package.json': { name: 'plain' },
      'node_modules/rollup/dist/shared/watch.js': '',
    },
  })
  const importer = (): string => dir.resolve('node_modules', 'rollup', 'dist', 'shared', 'watch.js')

  it('restricts a package whose manifest names an operating system, found above a nested importer', () => {
    expect(isPlatformRestrictedDep('fsevents', importer())).toBe(true)
  })

  it('restricts a scoped package whose manifest names an architecture, subpath included', () => {
    expect(isPlatformRestrictedDep('@scope/native/lib/index.js', importer())).toBe(true)
  })

  it('leaves a package whose platform lists are empty', () => {
    expect(isPlatformRestrictedDep('unrestricted', importer())).toBe(false)
  })

  it('leaves a package whose manifest names no platform', () => {
    expect(isPlatformRestrictedDep('plain', importer())).toBe(false)
  })

  it('leaves a package no node_modules above the importer holds', () => {
    expect(isPlatformRestrictedDep('absent', join(dir.path, 'src', 'index.js'))).toBe(false)
  })

  it('leaves relative, absolute, builtin and bundler-internal specifiers', () => {
    const specifiers = ['./sibling.js', dir.resolve('node_modules', 'fsevents', 'fsevents.js'), 'node:fs', '\0commonjs-proxy:fsevents']
    expect(specifiers.filter((specifier) => isPlatformRestrictedDep(specifier, importer()))).toEqual([])
  })

  it('leaves an entry, which has no importer', () => {
    expect(isPlatformRestrictedDep('fsevents', undefined)).toBe(false)
  })
})
