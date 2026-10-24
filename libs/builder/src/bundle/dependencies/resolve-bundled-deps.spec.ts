import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { resolveBundledDeps } from './resolve-bundled-deps'

const isHyperfrontend = (name: string): boolean => name.startsWith('@hyperfrontend/')

describe('resolveBundledDeps', () => {
  const dir = useTempDir({ prefix: 'builder-bundled-deps-' })

  const writePkg = (contents: object): string => dir.write('package.json', contents)

  it('returns an empty list when package.json is missing', () => {
    expect(resolveBundledDeps(dir.resolve('missing.json'))).toEqual([])
  })

  it('returns an empty list when package.json declares no dependencies', () => {
    const path = writePkg({})
    expect(resolveBundledDeps(path)).toEqual([])
  })

  it('returns all dependencies sorted when no filters are supplied', () => {
    const path = writePkg({ dependencies: { rollup: '*', '@rollup/plugin-json': '*', postject: '*' } })
    expect(resolveBundledDeps(path)).toEqual(['@rollup/plugin-json', 'postject', 'rollup'])
  })

  it('subtracts peerDependencies', () => {
    const path = writePkg({
      dependencies: { rollup: '*', react: '*' },
      peerDependencies: { react: '*' },
    })
    expect(resolveBundledDeps(path)).toEqual(['rollup'])
  })

  it('subtracts workspace packages identified by predicate', () => {
    const path = writePkg({
      dependencies: { '@hyperfrontend/logging': '*', rollup: '*' },
    })
    expect(resolveBundledDeps(path, { isWorkspacePackage: isHyperfrontend })).toEqual(['rollup'])
  })

  it('honours the include override even for missing dependencies', () => {
    const path = writePkg({ dependencies: { rollup: '*' } })
    expect(resolveBundledDeps(path, { include: ['lodash'] })).toEqual(['lodash', 'rollup'])
  })

  it('honours the exclude override', () => {
    const path = writePkg({ dependencies: { rollup: '*', postject: '*' } })
    expect(resolveBundledDeps(path, { exclude: ['postject'] })).toEqual(['rollup'])
  })

  it('exclude wins over include for the same package', () => {
    const path = writePkg({})
    expect(resolveBundledDeps(path, { include: ['lodash'], exclude: ['lodash'] })).toEqual([])
  })

  it('include cannot resurrect a peerDependency or workspace package', () => {
    const path = writePkg({
      dependencies: { rollup: '*' },
      peerDependencies: { react: '*' },
    })
    expect(
      resolveBundledDeps(path, {
        include: ['react', '@hyperfrontend/logging'],
        isWorkspacePackage: isHyperfrontend,
      })
    ).toEqual(['rollup'])
  })

  it('de-duplicates entries that appear via include and dependencies both', () => {
    const path = writePkg({ dependencies: { rollup: '*' } })
    expect(resolveBundledDeps(path, { include: ['rollup'] })).toEqual(['rollup'])
  })

  it('refuses to bundle typescript even when declared in dependencies', () => {
    const path = writePkg({ dependencies: { typescript: '*', rollup: '*' } })
    expect(resolveBundledDeps(path)).toEqual(['rollup'])
  })

  it('refuses to bundle typescript even when force-included via override', () => {
    const path = writePkg({ dependencies: { rollup: '*' } })
    expect(resolveBundledDeps(path, { include: ['typescript'] })).toEqual(['rollup'])
  })
})
