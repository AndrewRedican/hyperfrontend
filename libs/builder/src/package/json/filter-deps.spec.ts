import type { PackageJson } from '../../models'
import { filterWorkspaceDepsFromOutput } from './filter-deps'

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
