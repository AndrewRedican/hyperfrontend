import { describe, expect, it } from '@hyperfrontend/testing'
import { createPackageInfo } from './package-info'

describe('createPackageInfo', () => {
  it('creates package info with required fields', () => {
    const info = createPackageInfo({
      name: 'test-package',
      latestVersion: '1.0.0',
      versions: ['0.1.0', '1.0.0'],
    })

    expect(info).toEqual({
      name: 'test-package',
      latestVersion: '1.0.0',
      versions: ['0.1.0', '1.0.0'],
      maintainers: [],
    })
  })

  it('creates package info with all fields', () => {
    const info = createPackageInfo({
      name: 'test-package',
      latestVersion: '1.0.0',
      versions: ['1.0.0'],
      description: 'A test package',
      license: 'MIT',
      repository: 'https://github.com/test/test',
      homepage: 'https://test.com',
      maintainers: [{ name: 'Test', email: 'test@test.com' }],
      keywords: ['test', 'example'],
      lastModified: '2024-01-01T00:00:00Z',
    })

    expect(info).toEqual({
      name: 'test-package',
      latestVersion: '1.0.0',
      versions: ['1.0.0'],
      description: 'A test package',
      license: 'MIT',
      repository: 'https://github.com/test/test',
      homepage: 'https://test.com',
      maintainers: [{ name: 'Test', email: 'test@test.com' }],
      keywords: ['test', 'example'],
      lastModified: '2024-01-01T00:00:00Z',
    })
  })
})
