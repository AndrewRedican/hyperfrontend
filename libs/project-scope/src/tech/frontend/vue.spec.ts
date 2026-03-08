import type { PackageJson } from '../../project/package'
import * as fs from '../../core/fs'
import { vueDetector } from './vue'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as jest.MockedFunction<typeof fs.exists>

describe('vueDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when vue is not present', () => {
    const result = vueDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects vue from package.json', () => {
    const pkg: PackageJson = {
      dependencies: { vue: '^3.0.0' },
    }
    const result = vueDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('vue')
    expect(result?.name).toBe('Vue')
    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('detects Nuxt meta-framework', () => {
    const pkg: PackageJson = {
      dependencies: {
        vue: '^3.0.0',
        nuxt: '^3.0.0',
      },
    }
    const result = vueDetector('/some/path', pkg)

    expect(result?.metaFrameworks?.some((m) => m.id === 'nuxt')).toBe(true)
  })

  it('detects nuxt3 meta-framework', () => {
    const pkg: PackageJson = {
      dependencies: {
        vue: '^3.0.0',
        nuxt3: '^3.0.0',
      },
    }
    const result = vueDetector('/some/path', pkg)

    expect(result?.metaFrameworks?.some((m) => m.id === 'nuxt')).toBe(true)
  })

  it('increases confidence with @vue/cli-service', () => {
    const pkg: PackageJson = {
      dependencies: { vue: '^3.0.0' },
      devDependencies: { '@vue/cli-service': '^5.0.0' },
    }
    const result = vueDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(85)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.@vue/cli-service')).toBe(true)
  })

  it('increases confidence with .vue files in src', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('App.vue') || path.includes('main.vue')
    })

    const pkg: PackageJson = {
      dependencies: { vue: '^3.0.0' },
    }
    const result = vueDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
    expect(result?.detectedFrom.some((s) => s.path === 'src/*.vue')).toBe(true)
  })

  it('increases confidence with vue.config.js', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('vue.config.js')
    })

    const pkg: PackageJson = {
      dependencies: { vue: '^3.0.0' },
    }
    const result = vueDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
    expect(result?.detectedFrom.some((s) => s.path === 'vue.config.js')).toBe(true)
  })
})
