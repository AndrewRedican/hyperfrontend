import * as fs from '../../core/fs'
import { playwrightDetector, PLAYWRIGHT_CONFIG_PATTERNS } from './playwright'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

const mockExists = fs.exists as jest.MockedFunction<typeof fs.exists>

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

    expect(result).not.toBeNull()
    expect(result?.id).toBe('playwright')
    expect(result?.name).toBe('Playwright')
    expect(result?.type).toBe('e2e')
    expect(result?.version).toBe('1.40.0')
    expect(result?.confidence).toBeGreaterThan(0)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'dependencies.@playwright/test' }]))
  })

  it('detects playwright package', () => {
    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { playwright: '^1.40.0' },
    })

    expect(result?.id).toBe('playwright')
    expect(result?.version).toBe('1.40.0')
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.playwright')).toBe(true)
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
    expect(result?.configPath).toBe('playwright.config.ts')
  })

  it('increases confidence with e2e directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.endsWith('e2e') || path.includes('/e2e')
    })

    const result = playwrightDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@playwright/test': '^1.40.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
    expect(result?.detectedFrom.some((s) => s.path === 'e2e/ or tests/')).toBe(true)
  })

  it('increases confidence with tests directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.endsWith('tests') || path.includes('/tests')
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
    expect(result?.detectedFrom.some((s) => s.field === 'scripts.e2e or scripts.test:e2e')).toBe(true)
  })

  it('has maximum confidence with all indicators', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('playwright.config.ts') || path.endsWith('e2e') || path.includes('/e2e')
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
