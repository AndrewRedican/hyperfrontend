import { describe, expect, it } from '@hyperfrontend/testing'
import {
  APPLICATION_PROJECT_JSON,
  createNamedPackageJson,
  createPackageJson,
  createPublishableProjectJson,
  MINIMAL_PACKAGE_JSON,
  NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
  PUBLISHABLE_LIBRARY_PROJECT_JSON,
  PUBLISHABLE_PACKAGE_JSON,
} from './fixtures'

describe('Project.json fixtures', () => {
  it('PUBLISHABLE_LIBRARY_PROJECT_JSON is a valid publishable library', () => {
    expect(PUBLISHABLE_LIBRARY_PROJECT_JSON.projectType).toBe('library')
    expect(PUBLISHABLE_LIBRARY_PROJECT_JSON.targets).toHaveProperty('build')
    expect(PUBLISHABLE_LIBRARY_PROJECT_JSON.targets).toHaveProperty('publish')
  })

  it('NON_PUBLISHABLE_LIBRARY_PROJECT_JSON does not have publish target', () => {
    expect(NON_PUBLISHABLE_LIBRARY_PROJECT_JSON.projectType).toBe('library')
    expect(NON_PUBLISHABLE_LIBRARY_PROJECT_JSON.targets).toHaveProperty('build')
    expect(NON_PUBLISHABLE_LIBRARY_PROJECT_JSON.targets).not.toHaveProperty('publish')
  })

  it('APPLICATION_PROJECT_JSON is an application', () => {
    expect(APPLICATION_PROJECT_JSON.projectType).toBe('application')
  })
})

describe('Package.json fixtures', () => {
  it('PUBLISHABLE_PACKAGE_JSON has exports field', () => {
    expect(PUBLISHABLE_PACKAGE_JSON.exports).toBeDefined()
    expect(PUBLISHABLE_PACKAGE_JSON.name).toMatch(/^@hyperfrontend\//)
  })

  it('MINIMAL_PACKAGE_JSON has only name and version', () => {
    expect(Object.keys(MINIMAL_PACKAGE_JSON)).toContain('name')
    expect(Object.keys(MINIMAL_PACKAGE_JSON)).toContain('version')
  })
})

describe('Factory functions', () => {
  it('createPublishableProjectJson allows overrides', () => {
    const result = createPublishableProjectJson({ tags: ['custom'] })

    expect(result.projectType).toBe('library')
    expect(result.tags).toEqual(['custom'])
    expect(result.targets).toHaveProperty('build')
    expect(result.targets).toHaveProperty('publish')
  })

  it('createPackageJson allows overrides', () => {
    const result = createPackageJson({ name: '@custom/lib' })

    expect(result.name).toBe('@custom/lib')
    expect(result.exports).toBeDefined()
  })

  it('createNamedPackageJson sets name correctly', () => {
    const result = createNamedPackageJson('@test/my-lib')

    expect(result.name).toBe('@test/my-lib')
    expect(result.version).toBeDefined()
  })
})
