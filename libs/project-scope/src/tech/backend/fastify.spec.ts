import type { PackageJson } from '../../project/package'
import { describe, expect, it } from '@hyperfrontend/testing'
import { fastifyDetector } from './fastify'

describe('fastifyDetector', () => {
  it('returns null when fastify is not installed', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(fastifyDetector('/some/path', pkg)).toBeNull()
  })

  it('detects fastify dependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { fastify: '^4.0.0' },
    }
    const result = fastifyDetector('/some/path', pkg)
    expect(result).toEqual(expect.objectContaining({ id: 'fastify', version: '4.0.0' }))
  })

  it('scores a fastify dependency at least 60', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { fastify: '^4.0.0' },
    }
    const result = fastifyDetector('/some/path', pkg)
    expect(result?.confidence).toBeGreaterThanOrEqual(60)
  })

  it('detects fastify with plugins', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: {
        fastify: '^4.0.0',
        '@fastify/cors': '^8.0.0',
      },
    }
    const result = fastifyDetector('/some/path', pkg)
    expect(result?.confidence).toBeGreaterThan(60)
  })
})
