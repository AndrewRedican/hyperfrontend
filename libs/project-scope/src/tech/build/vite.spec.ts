import type { PackageJson } from '../../project/package'
import { describe, expect, it } from '@hyperfrontend/testing'
import { viteDetector } from './vite'

describe('viteDetector', () => {
  it('returns null when vite is not present', () => {
    const result = viteDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects vite from package.json dependencies', () => {
    const pkg: PackageJson = {
      devDependencies: { vite: '^5.0.0' },
    }
    const result = viteDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('vite')
    expect(result?.name).toBe('Vite')
    expect(result?.version).toBe('5.0.0')
    expect(result?.confidence).toBeGreaterThanOrEqual(60)
  })

  it('increases confidence with vitest', () => {
    const pkg: PackageJson = {
      devDependencies: {
        vite: '^5.0.0',
        vitest: '^1.0.0',
      },
    }
    const result = viteDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('detects vite plugins', () => {
    const pkg: PackageJson = {
      devDependencies: {
        vite: '^5.0.0',
        '@vitejs/plugin-react': '^4.0.0',
      },
    }
    const result = viteDetector('/some/path', pkg)

    expect(result?.detectedFrom.some((s) => s.field?.includes('vite plugins'))).toBe(true)
  })
})
