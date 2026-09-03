import type { PackageJson } from '../../project/package'
import { describe, expect, it } from '@hyperfrontend/testing'
import { honoDetector } from './hono'

describe('honoDetector', () => {
  it('returns null when hono is not installed', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(honoDetector('/some/path', pkg)).toBeNull()
  })

  it('detects hono dependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { hono: '^3.0.0' },
    }
    const result = honoDetector('/some/path', pkg)
    expect(result).not.toBeNull()
    expect(result?.id).toBe('hono')
    expect(result?.version).toBe('3.0.0')
    expect(result?.confidence).toBeGreaterThanOrEqual(60)
  })
})
