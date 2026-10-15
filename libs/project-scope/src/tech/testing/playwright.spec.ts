import type { MockedFunction } from '@hyperfrontend/testing'
import { sep } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { playwrightDetector, PLAYWRIGHT_CONFIG_PATTERNS } from './playwright'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

describe('playwrightDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('exports PLAYWRIGHT_CONFIG_PATTERNS', () => {
    expect(PLAYWRIGHT_CONFIG_PATTERNS).toEqual(expect.arrayContaining(['playwright.config.js', 'playwright.config.ts']))
  })

  it('returns null when playwright is not detected', () => {
    const result = playwrightDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects @playwright/test from package.json dependencies', () => {
    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@playwright/test': '^1.40.0' },
    })

    expect(result).toEqual(
      expect.objectContaining({
        id: 'playwright',
        name: 'Playwright',
        type: 'e2e',
        version: '1.40.0',
        detectedFrom: expect.arrayContaining([{ type: 'package.json', field: 'dependencies.@playwright/test' }]),
      })
    )
  })

  it('scores a @playwright/test dependency above zero', () => {
    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@playwright/test': '^1.40.0' },
    })

    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('detects playwright package', () => {
    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { playwright: '^1.40.0' },
    })

    expect(result).toEqual(
      expect.objectContaining({
        id: 'playwright',
        version: '1.40.0',
        detectedFrom: expect.arrayContaining([expect.objectContaining({ field: 'dependencies.playwright' })]),
      })
    )
  })

  it('prefers @playwright/test version over playwright', () => {
    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        '@playwright/test': '^1.40.0',
        playwright: '^1.35.0',
      },
    })

    expect(result?.version).toBe('1.40.0')
  })

  it('increases confidence with playwright config file', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('playwright.config.ts')
    })

    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@playwright/test': '^1.40.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
  })

  it('records playwright.config.ts as the config path', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('playwright.config.ts')
    })

    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@playwright/test': '^1.40.0' },
    })

    expect(result?.configPath).toBe('playwright.config.ts')
  })

  it('increases confidence with e2e directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.endsWith('e2e') || path.includes(`${sep}e2e`)
    })

    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@playwright/test': '^1.40.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('records the e2e directory as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.endsWith('e2e') || path.includes(`${sep}e2e`)
    })

    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@playwright/test': '^1.40.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'e2e/ or tests/' })]))
  })

  it('increases confidence with tests directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.endsWith('tests') || path.includes(`${sep}tests`)
    })

    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@playwright/test': '^1.40.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('increases confidence with playwright e2e script', () => {
    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@playwright/test': '^1.40.0' },
      scripts: { e2e: 'playwright test' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('records the playwright e2e script as a detection source', () => {
    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@playwright/test': '^1.40.0' },
      scripts: { e2e: 'playwright test' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'scripts.e2e or scripts.test:e2e' })]))
  })

  it('has maximum confidence with all indicators', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('playwright.config.ts') || path.endsWith('e2e') || path.includes(`${sep}e2e`)
    })

    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        '@playwright/test': '^1.40.0',
        playwright: '^1.40.0',
      },
      scripts: { e2e: 'playwright test' },
    })

    expect(result?.confidence).toBe(100)
  })
})
