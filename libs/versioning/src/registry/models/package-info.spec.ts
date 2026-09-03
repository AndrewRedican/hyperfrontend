import { describe, expect, it } from '@hyperfrontend/testing'
import { createPackageInfo } from './package-info'

describe('createPackageInfo', () => {
  it('creates package info with required fields', () => {
    const info = createPackageInfo({
      name: 'test-package',
      latestVersion: '1.0.0',
      versions: ['0.1.0', '1.0.0'],
    })

    expect(info.name).toBe('test-package')
    expect(info.latestVersion).toBe('1.0.0')
    expect(info.versions).toEqual(['0.1.0', '1.0.0'])
    expect(info.maintainers).toEqual([])
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

    expect(info.description).toBe('A test package')
    expect(info.license).toBe('MIT')
    expect(info.repository).toBe('https://github.com/test/test')
    expect(info.homepage).toBe('https://test.com')
    expect(info.maintainers).toHaveLength(1)
    expect(info.keywords).toEqual(['test', 'example'])
    expect(info.lastModified).toBe('2024-01-01T00:00:00Z')
  })
})
