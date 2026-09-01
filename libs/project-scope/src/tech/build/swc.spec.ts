import type { PackageJson } from '../../project/package'
import { describe, expect, it } from '@hyperfrontend/testing'
import { swcDetector } from './swc'

describe('swcDetector', () => {
  it('returns null when swc is not present', () => {
    const result = swcDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects swc from @swc/core', () => {
    const pkg: PackageJson = {
      devDependencies: { '@swc/core': '^1.0.0' },
    }
    const result = swcDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('swc')
    expect(result?.name).toBe('SWC')
    expect(result?.confidence).toBeGreaterThanOrEqual(60)
  })

  it('increases confidence with @swc/cli', () => {
    const pkg: PackageJson = {
      devDependencies: {
        '@swc/core': '^1.0.0',
        '@swc/cli': '^0.1.0',
      },
    }
    const result = swcDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })
})
