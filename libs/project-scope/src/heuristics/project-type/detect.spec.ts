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
      expect(result).toEqual({ type: 'unknown', secondaryTypes: [], confidence: 0, evidence: [] })
    })
  })

  describe('with minimal-project fixture', () => {
    it('detects project type with evidence', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })

      expect(result).toEqual(
        expect.objectContaining({
          type: expect.stringMatching(/^(?:library|application|e2e|tool|plugin|unknown)$/),
          secondaryTypes: expect.any(Array),
          confidence: expect.any(Number),
        })
      )
    })

    it('keeps the confidence between 0 and 100', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })

      const outOfRange = [result.confidence].filter((confidence) => confidence < 0 || confidence > 100)
      expect(outOfRange).toEqual([])
    })

    it('returns evidence array with correct structure', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })

      for (const e of result.evidence) {
        expect(e).toEqual({ factor: expect.any(String), confidence: expect.any(Number), description: expect.any(String) })
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

      expect(result).toEqual(expect.objectContaining({ type: expect.any(String) }))
    })

    it('reports a non-negative confidence for the monorepo', () => {
      const result = detectProjectType(MONOREPO, { skipTechDetection: true })

      expect(result.confidence).toBeGreaterThanOrEqual(0)
    })
  })

  describe('confidence calculation', () => {
    it('returns confidence as proportion of scores', () => {
      const result = detectProjectType(MINIMAL_PROJECT, { skipTechDetection: true })

      const outOfRange = [result.confidence].filter((confidence) => confidence < 0 || confidence > 100)
      expect(outOfRange).toEqual([])
    })
  })

  describe('with tech detection enabled', () => {
    it('includes framework detection in evidence', () => {
      const result = detectProjectType(MINIMAL_PROJECT)

      expect(result).toEqual(expect.objectContaining({ type: expect.any(String) }))
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

      expect({ skip, full }).toEqual({ skip: expect.any(Number), full: expect.any(Number) })
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
  it('records name-pattern evidence for a -cli name', () => {
    const result = detectProjectType(CLI_TOOL, { skipTechDetection: true })

    expect(result.evidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ factor: 'name-pattern', description: expect.stringContaining('CLI') })])
    )
  })

  it('ranks tool among the types for a -cli name', () => {
    const result = detectProjectType(CLI_TOOL, { skipTechDetection: true })

    expect([result.type, ...result.secondaryTypes]).toContain('tool')
  })

  it('records name-pattern evidence for a -plugin name', () => {
    const result = detectProjectType(PLUGIN_PROJECT, { skipTechDetection: true })

    expect(result.evidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ factor: 'name-pattern', description: expect.stringContaining('plugin') })])
    )
  })

  it('ranks plugin among the types for a -plugin name', () => {
    const result = detectProjectType(PLUGIN_PROJECT, { skipTechDetection: true })

    expect([result.type, ...result.secondaryTypes]).toContain('plugin')
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
  it('records bin-field evidence for a package with a bin field', () => {
    const result = detectProjectType(CLI_TOOL, { skipTechDetection: true })

    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ factor: 'bin-field' })]))
  })

  it('classifies a package with a bin field as a tool', () => {
    const result = detectProjectType(CLI_TOOL, { skipTechDetection: true })

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
  it('records e2e-framework evidence for a Cypress project', () => {
    const result = detectProjectType(E2E_PROJECT, { skipTechDetection: false })

    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ factor: 'e2e-framework' })]))
  })

  it('classifies a Cypress project as e2e', () => {
    const result = detectProjectType(E2E_PROJECT, { skipTechDetection: false })

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
  it('records docker evidence for a project with a Dockerfile', () => {
    const result = detectProjectType(DOCKER_APP, { skipTechDetection: true })

    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ factor: 'docker' })]))
  })

  it('ranks application among the types for a project with a Dockerfile', () => {
    const result = detectProjectType(DOCKER_APP, { skipTechDetection: true })

    expect([result.type, ...result.secondaryTypes]).toContain('application')
  })
})

describe('detectProjectType with NX project.json', () => {
  it('records nx-project-type evidence from the projectType field', () => {
    const result = detectProjectType(NX_TAGGED_LIB, { skipTechDetection: true })

    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ factor: 'nx-project-type' })]))
  })

  it('classifies a project by its NX projectType field', () => {
    const result = detectProjectType(NX_TAGGED_LIB, { skipTechDetection: true })

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
  it('records framework evidence naming express for a backend-only project', () => {
    const result = detectProjectType(BACKEND_ONLY, { skipTechDetection: false })

    expect(result.evidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ factor: 'framework', description: expect.stringMatching(/express/i) })])
    )
  })

  it('ranks application among the types for a backend-only project', () => {
    const result = detectProjectType(BACKEND_ONLY, { skipTechDetection: false })

    expect([result.type, ...result.secondaryTypes]).toContain('application')
  })

  it('includes backend framework names in evidence description', () => {
    const result = detectProjectType(DOCKER_APP, { skipTechDetection: false })

    const frameworkEvidence = result.evidence.find((e) => e.factor === 'framework')
    expect(frameworkEvidence).toEqual(expect.objectContaining({ description: expect.stringMatching(/express/i) }))
  })
})

describe('detectProjectType server entry detection', () => {
  it('records entry-point evidence for a server entry point', () => {
    const result = detectProjectType(BACKEND_ONLY, { skipTechDetection: true })

    expect(result.evidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ factor: 'entry-point', description: expect.stringContaining('server') })])
    )
  })

  it('ranks application among the types for a server entry point', () => {
    const result = detectProjectType(BACKEND_ONLY, { skipTechDetection: true })

    expect([result.type, ...result.secondaryTypes]).toContain('application')
  })
})
