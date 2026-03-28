import type { PackageJson } from '@hyperfrontend/project-scope/project/package'
import {
  createProject,
  isPublishable,
  isPrivate,
  hasChangelog,
  hasInternalDependencies,
  hasInternalDependents,
  getDependencyCount,
  getDependentCount,
  withDependents,
  addDependent,
} from './project'

describe('createProject', () => {
  const basePackageJson: PackageJson = {
    name: 'test-package',
    version: '1.0.0',
  }

  it('creates a basic project', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: basePackageJson,
    })

    expect(project.name).toBe('test-package')
    expect(project.version).toBe('1.0.0')
    expect(project.path).toBe('/workspace/packages/test')
    expect(project.packageJsonPath).toBe('/workspace/packages/test/package.json')
    expect(project.changelogPath).toBeNull()
    expect(project.internalDependencies).toEqual([])
    expect(project.internalDependents).toEqual([])
    expect(project.publishable).toBe(true)
    expect(project.private).toBe(false)
  })

  it('creates a private project', () => {
    const project = createProject({
      name: 'private-package',
      version: '1.0.0',
      path: '/workspace/packages/private',
      packageJsonPath: '/workspace/packages/private/package.json',
      packageJson: { ...basePackageJson, private: true },
    })

    expect(project.private).toBe(true)
    expect(project.publishable).toBe(false)
  })

  it('creates a project with changelog', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: basePackageJson,
      changelogPath: '/workspace/packages/test/CHANGELOG.md',
    })

    expect(project.changelogPath).toBe('/workspace/packages/test/CHANGELOG.md')
  })

  it('creates a project with internal dependencies', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: basePackageJson,
      internalDependencies: ['dep-a', 'dep-b'],
    })

    expect(project.internalDependencies).toEqual(['dep-a', 'dep-b'])
  })

  it('creates a project with internal dependents', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: basePackageJson,
      internalDependents: ['app-a', 'app-b'],
    })

    expect(project.internalDependents).toEqual(['app-a', 'app-b'])
  })

  it('sets changelogPath to null when not provided', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: basePackageJson,
    })

    expect(project.changelogPath).toBeNull()
  })
})

describe('isPublishable', () => {
  it('returns true for public packages', () => {
    const project = createProject({
      name: 'public-package',
      version: '1.0.0',
      path: '/workspace/packages/public',
      packageJsonPath: '/workspace/packages/public/package.json',
      packageJson: { name: 'public-package', version: '1.0.0' },
    })

    expect(isPublishable(project)).toBe(true)
  })

  it('returns false for private packages', () => {
    const project = createProject({
      name: 'private-package',
      version: '1.0.0',
      path: '/workspace/packages/private',
      packageJsonPath: '/workspace/packages/private/package.json',
      packageJson: { name: 'private-package', version: '1.0.0', private: true },
    })

    expect(isPublishable(project)).toBe(false)
  })
})

describe('isPrivate', () => {
  it('returns true for private packages', () => {
    const project = createProject({
      name: 'private-package',
      version: '1.0.0',
      path: '/workspace/packages/private',
      packageJsonPath: '/workspace/packages/private/package.json',
      packageJson: { name: 'private-package', version: '1.0.0', private: true },
    })

    expect(isPrivate(project)).toBe(true)
  })

  it('returns false for public packages', () => {
    const project = createProject({
      name: 'public-package',
      version: '1.0.0',
      path: '/workspace/packages/public',
      packageJsonPath: '/workspace/packages/public/package.json',
      packageJson: { name: 'public-package', version: '1.0.0' },
    })

    expect(isPrivate(project)).toBe(false)
  })
})

describe('hasChangelog', () => {
  it('returns true when changelog exists', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
      changelogPath: '/workspace/packages/test/CHANGELOG.md',
    })

    expect(hasChangelog(project)).toBe(true)
  })

  it('returns false when no changelog', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
    })

    expect(hasChangelog(project)).toBe(false)
  })
})

describe('hasInternalDependencies', () => {
  it('returns true when has internal dependencies', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
      internalDependencies: ['dep-a'],
    })

    expect(hasInternalDependencies(project)).toBe(true)
  })

  it('returns false when no internal dependencies', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
    })

    expect(hasInternalDependencies(project)).toBe(false)
  })
})

describe('hasInternalDependents', () => {
  it('returns true when has internal dependents', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
      internalDependents: ['app-a'],
    })

    expect(hasInternalDependents(project)).toBe(true)
  })

  it('returns false when no internal dependents', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
    })

    expect(hasInternalDependents(project)).toBe(false)
  })
})

describe('getDependencyCount', () => {
  it('returns the number of internal dependencies', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
      internalDependencies: ['dep-a', 'dep-b', 'dep-c'],
    })

    expect(getDependencyCount(project)).toBe(3)
  })

  it('returns zero when no dependencies', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
    })

    expect(getDependencyCount(project)).toBe(0)
  })
})

describe('getDependentCount', () => {
  it('returns the number of internal dependents', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
      internalDependents: ['app-a', 'app-b'],
    })

    expect(getDependentCount(project)).toBe(2)
  })

  it('returns zero when no dependents', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
    })

    expect(getDependentCount(project)).toBe(0)
  })
})

describe('withDependents', () => {
  it('creates a new project with updated dependents', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
    })

    const updated = withDependents(project, ['app-a', 'app-b'])

    expect(updated.internalDependents).toEqual(['app-a', 'app-b'])
    expect(updated.name).toBe('test-package')
    expect(project.internalDependents).toEqual([])
  })

  it('replaces existing dependents', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
      internalDependents: ['old-dep'],
    })

    const updated = withDependents(project, ['new-dep-a', 'new-dep-b'])

    expect(updated.internalDependents).toEqual(['new-dep-a', 'new-dep-b'])
  })
})

describe('addDependent', () => {
  it('adds a new dependent', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
    })

    const updated = addDependent(project, 'app-a')

    expect(updated.internalDependents).toEqual(['app-a'])
    expect(project.internalDependents).toEqual([])
  })

  it('does not duplicate existing dependent', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
      internalDependents: ['app-a'],
    })

    const updated = addDependent(project, 'app-a')

    expect(updated).toBe(project)
    expect(updated.internalDependents).toEqual(['app-a'])
  })

  it('appends to existing dependents', () => {
    const project = createProject({
      name: 'test-package',
      version: '1.0.0',
      path: '/workspace/packages/test',
      packageJsonPath: '/workspace/packages/test/package.json',
      packageJson: { name: 'test-package', version: '1.0.0' },
      internalDependents: ['app-a'],
    })

    const updated = addDependent(project, 'app-b')

    expect(updated.internalDependents).toEqual(['app-a', 'app-b'])
  })
})
