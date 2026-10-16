import type { PackageJson } from '../../project/package'
import { describe, expect, it } from '@hyperfrontend/testing'
import { koaDetector } from './koa'

describe('koaDetector', () => {
  it('returns null when koa is not installed', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(koaDetector('/some/path', pkg)).toBeNull()
  })

  it('detects koa dependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { koa: '^2.14.0' },
    }
    const result = koaDetector('/some/path', pkg)
    expect(result).toEqual(expect.objectContaining({ id: 'koa', version: '2.14.0' }))
  })

  it('scores a koa dependency at least 60', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { koa: '^2.14.0' },
    }
    const result = koaDetector('/some/path', pkg)
    expect(result?.confidence).toBeGreaterThanOrEqual(60)
  })

  it('detects koa with middleware', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: {
        koa: '^2.14.0',
        'koa-router': '^12.0.0',
        'koa-bodyparser': '^4.4.0',
      },
    }
    const result = koaDetector('/some/path', pkg)
    expect(result?.confidence).toBeGreaterThan(60)
  })
})
