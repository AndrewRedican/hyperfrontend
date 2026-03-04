import type { PackageJson } from './read'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  getDependencies,
  getProductionDependencies,
  getDevDependencies,
  getPeerDependencies,
  getAllDependencies,
  hasDependency,
  getDependencyVersion,
  getWorkspaces,
  hasWorkspaces,
  hasInstalledPackage,
  getInstalledVersion,
} from './dependencies'

const TEST_DIR = join(__dirname, '__test_fixtures_deps__')

describe('getDependencies', () => {
  it('extracts all dependency types', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
      devDependencies: { jest: '^29.0.0' },
      peerDependencies: { react: '^18.0.0' },
      optionalDependencies: { fsevents: '*' },
    }
    const deps = getDependencies(pkg)
    expect(deps.dependencies).toEqual({ react: '^18.0.0' })
    expect(deps.devDependencies).toEqual({ jest: '^29.0.0' })
    expect(deps.peerDependencies).toEqual({ react: '^18.0.0' })
    expect(deps.optionalDependencies).toEqual({ fsevents: '*' })
  })

  it('handles missing dependency fields', () => {
    const pkg: PackageJson = {}
    const deps = getDependencies(pkg)
    expect(deps.dependencies).toEqual({})
    expect(deps.devDependencies).toEqual({})
  })
})

describe('getProductionDependencies', () => {
  it('returns production dependencies only', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
      devDependencies: { jest: '^29.0.0' },
    }
    const deps = getProductionDependencies(pkg)

    expect(deps).toEqual({ react: '^18.0.0' })
  })

  it('returns empty object when no production dependencies', () => {
    const pkg: PackageJson = { devDependencies: { jest: '^29.0.0' } }
    const deps = getProductionDependencies(pkg)

    expect(deps).toEqual({})
  })
})

describe('getDevDependencies', () => {
  it('returns dev dependencies only', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
      devDependencies: { jest: '^29.0.0' },
    }
    const deps = getDevDependencies(pkg)

    expect(deps).toEqual({ jest: '^29.0.0' })
  })
})

describe('getPeerDependencies', () => {
  it('returns peer dependencies only', () => {
    const pkg: PackageJson = {
      dependencies: { lodash: '^4.0.0' },
      peerDependencies: { react: '^18.0.0' },
    }
    const deps = getPeerDependencies(pkg)

    expect(deps).toEqual({ react: '^18.0.0' })
  })
})

describe('getAllDependencies', () => {
  it('merges all dependency types', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
      devDependencies: { jest: '^29.0.0' },
      peerDependencies: { lodash: '^4.0.0' },
    }
    const deps = getAllDependencies(pkg)

    expect(deps['react']).toBe('^18.0.0')
    expect(deps['jest']).toBe('^29.0.0')
    expect(deps['lodash']).toBe('^4.0.0')
  })
})

describe('hasDependency', () => {
  it('returns true for existing production dependency', () => {
    const pkg: PackageJson = { dependencies: { react: '^18.0.0' } }
    expect(hasDependency(pkg, 'react')).toBe(true)
  })

  it('returns true for existing dev dependency', () => {
    const pkg: PackageJson = { devDependencies: { jest: '^29.0.0' } }
    expect(hasDependency(pkg, 'jest')).toBe(true)
  })

  it('returns false for non-existent dependency', () => {
    const pkg: PackageJson = {}
    expect(hasDependency(pkg, 'react')).toBe(false)
  })

  it('filters by specific dependency types', () => {
    const pkg: PackageJson = { devDependencies: { jest: '^29.0.0' } }
    expect(hasDependency(pkg, 'jest', ['dependencies'])).toBe(false)
    expect(hasDependency(pkg, 'jest', ['devDependencies'])).toBe(true)
  })
})

describe('getDependencyVersion', () => {
  it('returns version for existing production dependency', () => {
    const pkg: PackageJson = { dependencies: { react: '^18.0.0' } }
    expect(getDependencyVersion(pkg, 'react')).toBe('^18.0.0')
  })

  it('returns version for existing dev dependency', () => {
    const pkg: PackageJson = { devDependencies: { jest: '^29.0.0' } }
    expect(getDependencyVersion(pkg, 'jest')).toBe('^29.0.0')
  })

  it('returns null for non-existent dependency', () => {
    const pkg: PackageJson = {}
    expect(getDependencyVersion(pkg, 'react')).toBeNull()
  })

  it('prioritizes production over dev dependencies', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
      devDependencies: { react: '^17.0.0' },
    }
    expect(getDependencyVersion(pkg, 'react')).toBe('^18.0.0')
  })
})

describe('getWorkspaces', () => {
  it('returns workspace patterns from array format', () => {
    const pkg: PackageJson = {
      workspaces: ['packages/*', 'apps/*'],
    }
    const workspaces = getWorkspaces(pkg)

    expect(workspaces).toEqual(['packages/*', 'apps/*'])
  })

  it('returns workspace patterns from object format', () => {
    const pkg: PackageJson = {
      workspaces: { packages: ['packages/*', 'apps/*'] },
    }
    const workspaces = getWorkspaces(pkg)

    expect(workspaces).toEqual(['packages/*', 'apps/*'])
  })

  it('returns empty array when no workspaces', () => {
    const pkg: PackageJson = {}
    const workspaces = getWorkspaces(pkg)

    expect(workspaces).toEqual([])
  })
})

describe('hasWorkspaces', () => {
  it('returns true for package with workspaces', () => {
    const pkg: PackageJson = {
      workspaces: ['packages/*'],
    }
    expect(hasWorkspaces(pkg)).toBe(true)
  })

  it('returns false for package without workspaces', () => {
    const pkg: PackageJson = {}
    expect(hasWorkspaces(pkg)).toBe(false)
  })

  it('returns false for empty workspaces array', () => {
    const pkg: PackageJson = {
      workspaces: [],
    }
    expect(hasWorkspaces(pkg)).toBe(false)
  })
})

describe('hasInstalledPackage', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
    // Create node_modules with a mock package
    mkdirSync(join(TEST_DIR, 'node_modules', 'mock-pkg'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'node_modules', 'mock-pkg', 'package.json'), JSON.stringify({ name: 'mock-pkg', version: '1.2.3' }))
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('returns true for installed package', () => {
    const result = hasInstalledPackage(TEST_DIR, 'mock-pkg')

    expect(result).toBe(true)
  })

  it('returns false for non-installed package', () => {
    const result = hasInstalledPackage(TEST_DIR, 'non-existent-pkg')

    expect(result).toBe(false)
  })

  it('returns false for non-existent project path', () => {
    const result = hasInstalledPackage('/non/existent/path', 'any-pkg')

    expect(result).toBe(false)
  })
})

describe('getInstalledVersion', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
    // Create node_modules with a mock package
    mkdirSync(join(TEST_DIR, 'node_modules', 'version-pkg'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'node_modules', 'version-pkg', 'package.json'), JSON.stringify({ name: 'version-pkg', version: '2.0.0' }))
    // Create a package without version
    mkdirSync(join(TEST_DIR, 'node_modules', 'no-version-pkg'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'node_modules', 'no-version-pkg', 'package.json'), JSON.stringify({ name: 'no-version-pkg' }))
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('returns version for installed package', () => {
    const version = getInstalledVersion(TEST_DIR, 'version-pkg')

    expect(version).toBe('2.0.0')
  })

  it('returns null for non-installed package', () => {
    const version = getInstalledVersion(TEST_DIR, 'not-installed')

    expect(version).toBeNull()
  })

  it('returns null when package has no version field', () => {
    const version = getInstalledVersion(TEST_DIR, 'no-version-pkg')

    expect(version).toBeNull()
  })

  it('returns null for non-existent project path', () => {
    const version = getInstalledVersion('/non/existent/path', 'any-pkg')

    expect(version).toBeNull()
  })
})

describe('getDependencyVersion - edge cases', () => {
  it('returns version from peer dependencies', () => {
    const pkg: PackageJson = {
      peerDependencies: { 'peer-pkg': '^1.0.0' },
    }
    expect(getDependencyVersion(pkg, 'peer-pkg')).toBe('^1.0.0')
  })

  it('returns version from optional dependencies', () => {
    const pkg: PackageJson = {
      optionalDependencies: { 'optional-pkg': '^2.0.0' },
    }
    expect(getDependencyVersion(pkg, 'optional-pkg')).toBe('^2.0.0')
  })
})

describe('hasDependency - edge cases', () => {
  it('checks peerDependencies', () => {
    const pkg: PackageJson = { peerDependencies: { react: '^18.0.0' } }
    expect(hasDependency(pkg, 'react', ['peerDependencies'])).toBe(true)
  })

  it('checks optionalDependencies', () => {
    const pkg: PackageJson = { optionalDependencies: { fsevents: '*' } }
    expect(hasDependency(pkg, 'fsevents', ['optionalDependencies'])).toBe(true)
  })

  it('returns false when checking empty depType array', () => {
    const pkg: PackageJson = { dependencies: { react: '^18.0.0' } }
    expect(hasDependency(pkg, 'react', [])).toBe(false)
  })
})
