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
    expect(PUBLISHABLE_LIBRARY_PROJECT_JSON).toMatchObject({
      projectType: 'library',
      targets: { build: expect.anything(), publish: expect.anything() },
    })
  })

  it('NON_PUBLISHABLE_LIBRARY_PROJECT_JSON is a library with a build target', () => {
    expect(NON_PUBLISHABLE_LIBRARY_PROJECT_JSON).toMatchObject({ projectType: 'library', targets: { build: expect.anything() } })
  })

  it('NON_PUBLISHABLE_LIBRARY_PROJECT_JSON does not have publish target', () => {
    expect(NON_PUBLISHABLE_LIBRARY_PROJECT_JSON.targets).not.toHaveProperty('publish')
  })

  it('APPLICATION_PROJECT_JSON is an application', () => {
    expect(APPLICATION_PROJECT_JSON.projectType).toBe('application')
  })
})

describe('Package.json fixtures', () => {
  it('PUBLISHABLE_PACKAGE_JSON has exports field', () => {
    expect(PUBLISHABLE_PACKAGE_JSON.exports).toBeDefined()
  })

  it('PUBLISHABLE_PACKAGE_JSON is scoped under @hyperfrontend', () => {
    expect(PUBLISHABLE_PACKAGE_JSON.name).toMatch(/^@hyperfrontend\//)
  })

  it('MINIMAL_PACKAGE_JSON has only name and version', () => {
    expect(Object.keys(MINIMAL_PACKAGE_JSON)).toEqual(['name', 'version'])
  })
})

describe('Factory functions', () => {
  it('createPublishableProjectJson allows overrides', () => {
    expect(createPublishableProjectJson({ tags: ['custom'] })).toMatchObject({
      projectType: 'library',
      tags: ['custom'],
      targets: { build: expect.anything(), publish: expect.anything() },
    })
  })

  it('createPackageJson allows overrides', () => {
    expect(createPackageJson({ name: '@custom/lib' })).toMatchObject({ name: '@custom/lib', exports: expect.anything() })
  })

  it('createNamedPackageJson sets name correctly', () => {
    expect(createNamedPackageJson('@test/my-lib')).toMatchObject({ name: '@test/my-lib', version: expect.anything() })
  })
})
