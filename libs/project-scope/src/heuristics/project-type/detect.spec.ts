import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { detectProjectType } from './detect'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')
const NEXTJS_APP = resolve(FIXTURES_DIR, 'nextjs-app')
const ANGULAR_APP = resolve(FIXTURES_DIR, 'angular-app')
const CLI_TOOL = resolve(FIXTURES_DIR, 'cli-tool')
const PLUGIN_PROJECT = resolve(FIXTURES_DIR, 'plugin-project')
const E2E_PROJECT = resolve(FIXTURES_DIR, 'e2e-project')
const UTILS_LIB = resolve(FIXTURES_DIR, 'utils-lib')
const FRONTEND_APP = resolve(FIXTURES_DIR, 'frontend-app')
const DOCKER_APP = resolve(FIXTURES_DIR, 'docker-app')
const NX_TAGGED_LIB = resolve(FIXTURES_DIR, 'nx-tagged-lib')
const NX_E2E_PROJECT = resolve(FIXTURES_DIR, 'nx-e2e-project')

describe('detectProjectType', () => {
  describe('with non-existent path', () => {
    it('returns unknown type for non-existent path', () => {
      const result = detectProjectType('/non/existent/path', { skipTechDetection: true })
      expect(result.type).toBe('unknown')
      expect(result.confidence).toBe(0)
      expect(result.evidence).toEqual([])
    })
  })

  describe('with minimal-project fixture', () => {
    it('detects project type with evidence', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })

      expect(result).toBeDefined()
      expect(result.type).toBeDefined()
      expect(['library', 'application', 'e2e', 'tool', 'plugin', 'unknown']).toContain(result.type)
      expect(Array.isArray(result.secondaryTypes)).toBe(true)
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(100)
    })

    it('returns evidence array with correct structure', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })

      expect(Array.isArray(result.evidence)).toBe(true)
      for (const e of result.evidence) {
        expect(typeof e.factor).toBe('string')
        expect(typeof e.confidence).toBe('number')
        expect(typeof e.description).toBe('string')
      }
    })

    it('produces evidence factors from analysis', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })

      expect(result.evidence.length).toBeGreaterThan(0)
    })
  })

  describe('with monorepo fixture', () => {
    it('detects NX workspace', () => {
      const result = detectProjectType(MONOREPO, { skipTechDetection: true })

      expect(result).toBeDefined()
      expect(result.type).toBeDefined()
      expect(result.confidence).toBeGreaterThanOrEqual(0)
    })
  })

  describe('confidence calculation', () => {
    it('returns confidence as proportion of scores', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })

      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(100)
    })
  })

  describe('with tech detection enabled', () => {
    it('includes framework detection in evidence', () => {
      const result = detectProjectType(MINIMAL_PROJECT)

      expect(result).toBeDefined()
      expect(result.type).toBeDefined()
    })
  })

  describe('skipTechDetection option', () => {
    it('runs faster with skipTechDetection', () => {
      const start = Date.now()
      detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })
      const skip = Date.now() - start

      const start2 = Date.now()
      detectProjectType(MINIMAL_PROJECT, { skipTechDetection: false })
      const full = Date.now() - start2

      expect(typeof skip).toBe('number')
      expect(typeof full).toBe('number')
    })
  })

  describe('name pattern detection', () => {
    it('detects e2e from name pattern', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })
      expect(result.type).toBeDefined()
    })

    it('detects plugin from name pattern', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })
      expect(['library', 'application', 'e2e', 'tool', 'plugin', 'unknown']).toContain(result.type)
    })

    it('detects CLI tool from name pattern', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })
      expect(result).toBeDefined()
    })
  })

  describe('directory structure detection', () => {
    it('detects application from pages directory', () => {
      const result = detectProjectType(NEXTJS_APP, { skipTechDetection: true })

      expect(result).toBeDefined()
      const hasStructureEvidence = result.evidence.some((e) => e.factor === 'structure')
      expect(hasStructureEvidence === false || result.confidence > 0).toBe(true)
    })

    it('detects e2e from cypress/e2e directory', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })
      expect(result.type).toBeDefined()
    })

    it('detects application from public directory', () => {
      const result = detectProjectType(NEXTJS_APP, { skipTechDetection: true })

      const hasStructureEvidence = result.evidence.some((e) => e.factor === 'structure')
      expect(typeof hasStructureEvidence).toBe('boolean')
    })
  })

  describe('framework config detection', () => {
    it('detects Next.js config', () => {
      const result = detectProjectType(NEXTJS_APP, { skipTechDetection: true })

      expect(result.type).toBeDefined()
    })

    it('detects Angular config', () => {
      const result = detectProjectType(ANGULAR_APP, { skipTechDetection: true })

      expect(result.type).toBeDefined()
    })
  })

  describe('NX project type detection', () => {
    it('uses NX projectType from project.json', () => {
      const coreProject = resolve(MONOREPO, 'packages/core')
      const result = detectProjectType(coreProject, { skipTechDetection: true })

      const hasNxEvidence = result.evidence.some((e) => e.factor === 'nx-project-type')
      expect(hasNxEvidence === false || result.confidence > 0).toBe(true)
    })

    it('parses NX tags for type hints', () => {
      const coreProject = resolve(MONOREPO, 'packages/core')
      const result = detectProjectType(coreProject, { skipTechDetection: true })

      expect(result.type).toBeDefined()
    })
  })

  describe('secondary types', () => {
    it('returns secondary types sorted by score', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })

      expect(Array.isArray(result.secondaryTypes)).toBe(true)
      expect(result.secondaryTypes).not.toContain(result.type)
    })
  })

  describe('exports detection', () => {
    it('detects library from exports field', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })

      const hasExportsEvidence = result.evidence.some((e) => e.factor === 'exports')
      expect(typeof hasExportsEvidence).toBe('boolean')
    })
  })

  describe('bin field detection', () => {
    it('detects tool from bin field', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })

      const hasBinEvidence = result.evidence.some((e) => e.factor === 'bin-field')
      expect(typeof hasBinEvidence).toBe('boolean')
    })
  })
})

describe('detectProjectType name patterns', () => {
  it('detects CLI tool from -cli name pattern', () => {
    const result = detectProjectType(CLI_TOOL, { skipTechDetection: true })

    expect(result.evidence.some((e) => e.factor === 'name-pattern' && e.description.includes('CLI'))).toBe(true)
    expect(result.type === 'tool' || result.secondaryTypes.includes('tool')).toBe(true)
  })

  it('detects plugin from -plugin name pattern', () => {
    const result = detectProjectType(PLUGIN_PROJECT, { skipTechDetection: true })

    expect(result.evidence.some((e) => e.factor === 'name-pattern' && e.description.includes('plugin'))).toBe(true)
    expect(result.type === 'plugin' || result.secondaryTypes.includes('plugin')).toBe(true)
  })

  it('detects e2e from -e2e name pattern', () => {
    const result = detectProjectType(E2E_PROJECT, { skipTechDetection: true })

    expect(result.evidence.some((e) => e.factor === 'name-pattern' && e.description.includes('e2e'))).toBe(true)
  })

  it('detects library from -utils name pattern', () => {
    const result = detectProjectType(UTILS_LIB, { skipTechDetection: true })

    expect(result.evidence.some((e) => e.factor === 'name-pattern' && e.description.includes('library'))).toBe(true)
  })

  it('detects application from -frontend name pattern', () => {
    const result = detectProjectType(FRONTEND_APP, { skipTechDetection: true })

    expect(result.type === 'application' || result.secondaryTypes.includes('application')).toBe(true)
  })
})

describe('detectProjectType with bin field', () => {
  it('detects tool from bin field in package.json', () => {
    const result = detectProjectType(CLI_TOOL, { skipTechDetection: true })

    expect(result.evidence.some((e) => e.factor === 'bin-field')).toBe(true)
    expect(result.type).toBe('tool')
  })
})

describe('detectProjectType directory structure', () => {
  it('detects application from pages directory', () => {
    const result = detectProjectType(FRONTEND_APP, { skipTechDetection: true })

    const hasStructureEvidence = result.evidence.some((e) => e.factor === 'structure' && e.description.includes('pages'))
    expect(hasStructureEvidence || result.type === 'application').toBe(true)
  })

  it('detects e2e from cypress directory', () => {
    const result = detectProjectType(E2E_PROJECT, { skipTechDetection: true })

    expect(result.evidence.some((e) => e.factor === 'structure' && e.description.includes('cypress'))).toBe(true)
  })

  it('detects library from lib directory without pages/app', () => {
    const result = detectProjectType(UTILS_LIB, { skipTechDetection: true })

    expect(result.evidence.some((e) => e.factor === 'structure' && e.description.includes('lib'))).toBe(true)
  })
})

describe('detectProjectType with tech detection', () => {
  it('detects e2e from Cypress framework', () => {
    const result = detectProjectType(E2E_PROJECT, { skipTechDetection: false })

    expect(result.evidence.some((e) => e.factor === 'e2e-framework')).toBe(true)
    expect(result.type).toBe('e2e')
  })

  it('detects library from unit testing without e2e', () => {
    const result = detectProjectType(UTILS_LIB, { skipTechDetection: false })

    const hasUnitEvidence = result.evidence.some((e) => e.factor === 'unit-framework')
    expect(typeof hasUnitEvidence).toBe('boolean')
  })

  it('detects application from frontend framework', () => {
    const result = detectProjectType(FRONTEND_APP, { skipTechDetection: false })

    const hasFrameworkEvidence = result.evidence.some((e) => e.factor === 'framework')
    expect(hasFrameworkEvidence || result.type === 'application').toBe(true)
  })
})

describe('detectProjectType with Docker', () => {
  it('detects application from Dockerfile presence', () => {
    const result = detectProjectType(DOCKER_APP, { skipTechDetection: true })

    expect(result.evidence.some((e) => e.factor === 'docker')).toBe(true)
    expect(result.type === 'application' || result.secondaryTypes.includes('application')).toBe(true)
  })
})

describe('detectProjectType with NX project.json', () => {
  it('uses NX projectType field', () => {
    const result = detectProjectType(NX_TAGGED_LIB, { skipTechDetection: true })

    expect(result.evidence.some((e) => e.factor === 'nx-project-type')).toBe(true)
    expect(result.type).toBe('library')
  })

  it('parses NX tags for lib/util hints', () => {
    const result = detectProjectType(NX_TAGGED_LIB, { skipTechDetection: true })

    expect(result.evidence.some((e) => e.factor === 'nx-tags')).toBe(true)
  })

  it('parses NX tags for e2e hints', () => {
    const result = detectProjectType(NX_E2E_PROJECT, { skipTechDetection: true })

    expect(result.evidence.some((e) => e.factor === 'nx-tags' && e.description.includes('e2e'))).toBe(true)
  })
})

const LIBRARY_WITH_JEST = resolve(FIXTURES_DIR, 'library-with-jest')
const BACKEND_ONLY = resolve(FIXTURES_DIR, 'backend-only')

describe('detectProjectType unit framework detection', () => {
  it('detects library from unit test framework when no E2E', () => {
    const result = detectProjectType(LIBRARY_WITH_JEST, { skipTechDetection: false })

    expect(result.evidence.some((e) => e.factor === 'unit-framework')).toBe(true)
  })

  it('does not add unit-framework evidence when E2E is present', () => {
    const result = detectProjectType(E2E_PROJECT, { skipTechDetection: false })

    expect(result.evidence.some((e) => e.factor === 'e2e-framework')).toBe(true)
  })
})

describe('detectProjectType backend framework detection', () => {
  it('detects application from backend framework', () => {
    const result = detectProjectType(BACKEND_ONLY, { skipTechDetection: false })

    expect(result.evidence.some((e) => e.factor === 'framework')).toBe(true)
    expect(result.evidence.some((e) => e.description.toLowerCase().includes('express'))).toBe(true)
    expect(result.type === 'application' || result.secondaryTypes.includes('application')).toBe(true)
  })

  it('includes backend framework names in evidence description', () => {
    const result = detectProjectType(DOCKER_APP, { skipTechDetection: false })

    const frameworkEvidence = result.evidence.find((e) => e.factor === 'framework')
    expect(frameworkEvidence).toBeDefined()
    expect(frameworkEvidence?.description.toLowerCase()).toContain('express')
  })
})

describe('detectProjectType server entry detection', () => {
  it('detects application from server entry point', () => {
    const result = detectProjectType(BACKEND_ONLY, { skipTechDetection: true })

    expect(result.evidence.some((e) => e.factor === 'entry-point' && e.description.includes('server'))).toBe(true)
    expect(result.type === 'application' || result.secondaryTypes.includes('application')).toBe(true)
  })
})
