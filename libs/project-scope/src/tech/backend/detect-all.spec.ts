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
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('express')
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
    expect(results.length).toBeGreaterThanOrEqual(2)
    const ids = results.map((r) => r.id)
    expect(ids).toContain('nestjs')
    expect(ids).toContain('fastify')
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
  it('exports array of detector objects', () => {
    expect(Array.isArray(backendDetectors)).toBe(true)
    expect(backendDetectors.length).toBe(5)
    backendDetectors.forEach((detector) => {
      expect(typeof detector).toBe('object')
      expect(typeof detector.detect).toBe('function')
      expect(typeof detector.id).toBe('string')
      expect(typeof detector.name).toBe('string')
    })
  })
})
