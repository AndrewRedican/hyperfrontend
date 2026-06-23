import type { PackageJson } from '../../models'
import { filterBundledDepsFromOutput, filterWorkspaceDepsFromOutput } from './filter-deps'

const isHyperfrontend = (name: string): boolean => name.startsWith('@hyperfrontend/')

describe('filterWorkspaceDepsFromOutput', () => {
  it('returns pkg unchanged when no dependencies field is present', () => {
    const pkg: PackageJson = { name: 'foo' }
    expect(filterWorkspaceDepsFromOutput(pkg, isHyperfrontend)).toEqual({ name: 'foo' })
  })

  it('removes only the workspace-internal entries from dependencies', () => {
    const pkg: PackageJson = {
      name: 'foo',
      dependencies: { '@hyperfrontend/logging': '*', lodash: '^4', '@hyperfrontend/project-scope': '*' },
    }
    expect(filterWorkspaceDepsFromOutput(pkg, isHyperfrontend).dependencies).toEqual({ lodash: '^4' })
  })

  it('drops the dependencies field entirely when only workspace deps remain', () => {
    const pkg: PackageJson = { name: 'foo', dependencies: { '@hyperfrontend/logging': '*' } }
    expect(filterWorkspaceDepsFromOutput(pkg, isHyperfrontend).dependencies).toBeUndefined()
  })

  it('preserves peerDependencies and optionalDependencies untouched', () => {
    const pkg: PackageJson = {
      name: 'foo',
      dependencies: { '@hyperfrontend/logging': '*' },
      peerDependencies: { react: '*', '@hyperfrontend/logging': '*' },
      optionalDependencies: { '@hyperfrontend/logging': '*' },
    }
    const result = filterWorkspaceDepsFromOutput(pkg, isHyperfrontend)
    expect(result.peerDependencies).toEqual({ react: '*', '@hyperfrontend/logging': '*' })
    expect(result.optionalDependencies).toEqual({ '@hyperfrontend/logging': '*' })
  })

  it('does not mutate the input package.json', () => {
    const pkg: PackageJson = { name: 'foo', dependencies: { '@hyperfrontend/logging': '*', lodash: '*' } }
    filterWorkspaceDepsFromOutput(pkg, isHyperfrontend)
    expect(pkg.dependencies).toEqual({ '@hyperfrontend/logging': '*', lodash: '*' })
  })
})

describe('filterBundledDepsFromOutput', () => {
  it('returns pkg unchanged when bundledDeps is empty', () => {
    const pkg: PackageJson = { name: 'foo', dependencies: { rollup: '*' } }
    expect(filterBundledDepsFromOutput(pkg, [])).toBe(pkg)
  })

  it('returns pkg unchanged when no dependencies field is present', () => {
    const pkg: PackageJson = { name: 'foo' }
    expect(filterBundledDepsFromOutput(pkg, ['rollup'])).toEqual({ name: 'foo' })
  })

  it('removes only the bundled-dep entries from dependencies', () => {
    const pkg: PackageJson = { name: 'foo', dependencies: { rollup: '*', lodash: '*' } }
    expect(filterBundledDepsFromOutput(pkg, ['rollup']).dependencies).toEqual({ lodash: '*' })
  })

  it('drops the dependencies field entirely when only bundled deps remain', () => {
    const pkg: PackageJson = { name: 'foo', dependencies: { rollup: '*', postject: '*' } }
    expect(filterBundledDepsFromOutput(pkg, ['rollup', 'postject']).dependencies).toBeUndefined()
  })

  it('preserves peerDependencies and optionalDependencies untouched', () => {
    const pkg: PackageJson = {
      name: 'foo',
      dependencies: { rollup: '*' },
      peerDependencies: { react: '*' },
      optionalDependencies: { typescript: '*' },
    }
    const result = filterBundledDepsFromOutput(pkg, ['rollup'])
    expect(result.peerDependencies).toEqual({ react: '*' })
    expect(result.optionalDependencies).toEqual({ typescript: '*' })
  })

  it('does not mutate the input package.json', () => {
    const pkg: PackageJson = { name: 'foo', dependencies: { rollup: '*', lodash: '*' } }
    filterBundledDepsFromOutput(pkg, ['rollup'])
    expect(pkg.dependencies).toEqual({ rollup: '*', lodash: '*' })
  })
})
