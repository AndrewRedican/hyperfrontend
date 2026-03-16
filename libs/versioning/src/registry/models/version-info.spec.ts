import { createVersionInfo } from './version-info'

describe('createVersionInfo', () => {
  it('creates version info with required fields', () => {
    const info = createVersionInfo({
      version: '1.0.0',
      publishedAt: '2024-01-01T00:00:00Z',
      tarball: 'https://registry.npmjs.org/test/-/test-1.0.0.tgz',
    })

    expect(info.version).toBe('1.0.0')
    expect(info.publishedAt).toBe('2024-01-01T00:00:00Z')
    expect(info.tarball).toBe('https://registry.npmjs.org/test/-/test-1.0.0.tgz')
  })

  it('creates version info with dependencies', () => {
    const info = createVersionInfo({
      version: '1.0.0',
      publishedAt: '2024-01-01T00:00:00Z',
      tarball: 'https://example.com/test.tgz',
      dependencies: { lodash: '^4.17.0' },
      devDependencies: { jest: '^29.0.0' },
      peerDependencies: { react: '>=16.8.0' },
    })

    expect(info.dependencies).toEqual({ lodash: '^4.17.0' })
    expect(info.devDependencies).toEqual({ jest: '^29.0.0' })
    expect(info.peerDependencies).toEqual({ react: '>=16.8.0' })
  })

  it('includes engine requirements', () => {
    const info = createVersionInfo({
      version: '1.0.0',
      publishedAt: '2024-01-01T00:00:00Z',
      tarball: 'https://example.com/test.tgz',
      engines: { node: '>=18.0.0' },
      nodeVersion: '18.0.0',
      npmVersion: '9.0.0',
    })

    expect(info.engines).toEqual({ node: '>=18.0.0' })
    expect(info.nodeVersion).toBe('18.0.0')
    expect(info.npmVersion).toBe('9.0.0')
  })
})
