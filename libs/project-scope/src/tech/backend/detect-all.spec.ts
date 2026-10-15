import type { PackageJson } from '../../project/package'
import { describe, expect, it } from '@hyperfrontend/testing'
import { detectBackendFrameworks, backendDetectors } from './detect-all'

describe('detectBackendFrameworks', () => {
  it('returns empty array when no frameworks detected', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(detectBackendFrameworks('/some/path', pkg)).toEqual([])
  })

  it('detects single backend framework', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { express: '^4.18.0' },
    }
    const results = detectBackendFrameworks('/some/path', pkg)
    expect(results).toEqual([expect.objectContaining({ id: 'express' })])
  })

  it('detects multiple backend frameworks', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: {
        '@nestjs/core': '^10.0.0',
        fastify: '^4.0.0',
      },
    }
    const results = detectBackendFrameworks('/some/path', pkg)
    expect(results.map((r) => r.id)).toEqual(expect.arrayContaining(['nestjs', 'fastify']))
  })

  it('sorts results by confidence', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: {
        express: '^4.18.0',
        koa: '^2.14.0',
        hono: '^3.0.0',
      },
    }
    const results = detectBackendFrameworks('/some/path', pkg)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence)
    }
  })
})

describe('backendDetectors', () => {
  it('exports every backend detector', () => {
    expect(backendDetectors.map((detector) => detector.id)).toEqual(['express', 'nestjs', 'fastify', 'koa', 'hono'])
  })

  it('gives every detector an id, a name and a detect function', () => {
    backendDetectors.forEach((detector) => {
      expect(detector).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String), detect: expect.any(Function) }))
    })
  })
})
