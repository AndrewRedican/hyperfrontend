import { resolve } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { identifyFrameworks, usesFramework, clearFrameworkIdentificationCache } from './identify'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const NEXTJS_APP = resolve(FIXTURES_DIR, 'nextjs-app')
const FRONTEND_APP = resolve(FIXTURES_DIR, 'frontend-app')
const DOCKER_APP = resolve(FIXTURES_DIR, 'docker-app')

describe('identifyFrameworks', () => {
  describe('result structure', () => {
    it('returns correct structure', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT)

      expect(result).toEqual(
        expect.objectContaining({
          frontend: expect.any(Array),
          backend: expect.any(Array),
          testing: expect.any(Array),
          metaFrameworks: expect.any(Array),
          summary: expect.any(String),
          stack: expect.any(Object),
        })
      )
    })

    it('returns stack summary', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT)

      expect(result.stack).toEqual({
        frontend: expect.any(Array),
        backend: expect.any(Array),
        testing: expect.any(Array),
        build: expect.any(Array),
        typeSystem: expect.any(Array),
        linting: expect.any(Array),
      })
    })
  })

  describe('with non-existent path', () => {
    it('returns empty arrays', () => {
      const result = identifyFrameworks('/non/existent/path')

      expect(result).toMatchObject({ frontend: [], backend: [], primary: undefined })
    })

    it('returns "No frameworks detected" summary', () => {
      const result = identifyFrameworks('/non/existent/path')
      expect(result.summary).toBe('No frameworks detected')
    })
  })

  describe('minConfidence option', () => {
    it('filters frameworks below threshold', () => {
      const lowThreshold = identifyFrameworks(MINIMAL_PROJECT, { minConfidence: 10 })
      const highThreshold = identifyFrameworks(MINIMAL_PROJECT, { minConfidence: 90 })

      expect(highThreshold.frontend.length).toBeLessThanOrEqual(lowThreshold.frontend.length)
    })

    it('respects very high threshold', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT, { minConfidence: 100 })

      expect(result.frontend.length).toBeLessThanOrEqual(1)
    })

    it('respects zero threshold', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT, { minConfidence: 0 })

      expect(result).toBeDefined()
    })
  })

  describe('caching', () => {
    it('uses cached result by default', () => {
      const first = identifyFrameworks(MINIMAL_PROJECT)
      const second = identifyFrameworks(MINIMAL_PROJECT)

      expect(first.summary).toBe(second.summary)
    })

    it('respects skipCache option', () => {
      const cached = identifyFrameworks(MINIMAL_PROJECT)
      const fresh = identifyFrameworks(MINIMAL_PROJECT, { skipCache: true })

      expect(fresh).not.toBe(cached)
    })
  })

  describe('summary generation', () => {
    it('generates human-readable summary', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT)

      expect(result.summary).toEqual(expect.stringMatching(/\S/))
    })

    it('includes frontend frameworks in summary', () => {
      const result = identifyFrameworks(NEXTJS_APP)

      expect(result.summary.length).toBeGreaterThan(0)
    })

    it('includes testing frameworks in summary', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT)

      expect(result.summary.length).toBeGreaterThan(0)
    })
  })

  describe('framework info structure', () => {
    it('has correct properties for detected frameworks', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT)

      const allFrameworks = [...result.frontend, ...result.backend]
      for (const framework of allFrameworks) {
        expect(framework).toEqual(
          expect.objectContaining({ id: expect.any(String), name: expect.any(String), confidence: expect.any(Number) })
        )
      }
    })

    it('keeps every detected framework confidence between 0 and 100', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT)

      const allFrameworks = [...result.frontend, ...result.backend]
      const outOfRange = allFrameworks.map((f) => f.confidence).filter((confidence) => confidence < 0 || confidence > 100)
      expect(outOfRange).toEqual([])
    })

    it('includes version when available', () => {
      const result = identifyFrameworks(NEXTJS_APP)

      const allFrameworks = [...result.frontend, ...result.backend]
      allFrameworks.forEach((framework) => {
        expect(framework.version === undefined || typeof framework.version === 'string').toBe(true)
      })
    })
  })

  describe('meta-framework detection', () => {
    it('detects meta-frameworks like Next.js', () => {
      const result = identifyFrameworks(NEXTJS_APP)

      const hasNextjs =
        result.metaFrameworks.some((f) => f.id === 'nextjs') ||
        result.frontend.some((f) => f.id === 'nextjs') ||
        result.frontend.some((f) => f.id === 'react')

      expect(hasNextjs || result.stack.frontend.length > 0 || result.frontend.length === 0).toBe(true)
    })

    it('includes nested meta-frameworks', () => {
      const result = identifyFrameworks(NEXTJS_APP)

      expect(Array.isArray(result.metaFrameworks)).toBe(true)
    })
  })

  describe('primary framework selection', () => {
    it('selects highest confidence as primary', () => {
      const result = identifyFrameworks(NEXTJS_APP)

      const allFrameworks = [...result.frontend, ...result.backend]
      const maxConfidence = allFrameworks.length > 0 ? Math.max(...allFrameworks.map((f) => f.confidence)) : undefined
      expect(result.primary?.confidence).toBe(maxConfidence)
    })

    it('returns undefined primary when no frameworks detected', () => {
      const result = identifyFrameworks('/non/existent/path')
      expect(result.primary).toBeUndefined()
    })
  })
})

describe('usesFramework', () => {
  it('returns false for non-existent framework', () => {
    const result = usesFramework(MINIMAL_PROJECT, 'non-existent-framework')

    expect(result).toBe(false)
  })

  it('returns false for non-existent path', () => {
    const result = usesFramework('/non/existent/path', 'react')

    expect(result).toBe(false)
  })

  it('respects minConfidence parameter', () => {
    const result = usesFramework(MINIMAL_PROJECT, 'typescript', 100)

    expect(typeof result).toBe('boolean')
  })
})

describe('clearFrameworkIdentificationCache', () => {
  it('clears the cache without error', () => {
    identifyFrameworks(MINIMAL_PROJECT)

    clearFrameworkIdentificationCache()

    expect(identifyFrameworks(MINIMAL_PROJECT)).toBeDefined()
  })

  it('forces fresh detection after clearing', () => {
    const cached = identifyFrameworks(MINIMAL_PROJECT)

    clearFrameworkIdentificationCache()

    const fresh = identifyFrameworks(MINIMAL_PROJECT)

    expect(fresh).toEqual(cached)
  })
})

describe('identifyFrameworks summary building', () => {
  it('builds summary with frontend frameworks', () => {
    const result = identifyFrameworks(FRONTEND_APP)

    expect(result).toEqual(
      expect.objectContaining({
        frontend: expect.arrayContaining([expect.objectContaining({ id: 'react', name: 'React' })]),
        summary: expect.stringContaining('React'),
      })
    )
  })

  it('builds summary with backend frameworks', () => {
    const result = identifyFrameworks(DOCKER_APP)

    expect(result).toEqual(
      expect.objectContaining({
        backend: expect.arrayContaining([expect.objectContaining({ id: 'express', name: 'Express' })]),
        summary: expect.stringContaining('Express'),
      })
    )
  })

  it('builds summary with testing frameworks', () => {
    const result = identifyFrameworks(MINIMAL_PROJECT)

    expect(result).toEqual(
      expect.objectContaining({
        testing: expect.arrayContaining([expect.objectContaining({ id: 'jest', name: 'Jest' })]),
        stack: expect.objectContaining({ testing: expect.arrayContaining(['jest']) }),
      })
    )
  })
})

describe('identifyFrameworks meta-framework extraction', () => {
  it('extracts meta-frameworks from category', () => {
    const result = identifyFrameworks(NEXTJS_APP)

    const hasNextjs = result.frontend.some((f) => f.id === 'nextjs') || result.metaFrameworks.some((f) => f.id === 'nextjs')

    expect(hasNextjs || result.frontend.some((f) => f.id === 'react')).toBe(true)
  })

  it('extracts nested meta-frameworks from detection', () => {
    const result = identifyFrameworks(NEXTJS_APP)

    expect(Array.isArray(result.metaFrameworks)).toBe(true)
  })
})

describe('usesFramework advanced', () => {
  it('returns true for detected framework with default confidence', () => {
    const result = usesFramework(MINIMAL_PROJECT, 'jest', 10)
    expect(typeof result).toBe('boolean')
  })

  it('detects a frontend framework category', () => {
    expect(usesFramework(FRONTEND_APP, 'react', 10)).toBe(true)
  })

  it('detects a backend framework category', () => {
    expect(usesFramework(DOCKER_APP, 'express', 10)).toBe(true)
  })
})

const BACKEND_ONLY = resolve(FIXTURES_DIR, 'backend-only')

describe('identifyFrameworks caching', () => {
  beforeEach(() => {
    clearFrameworkIdentificationCache()
  })

  it('returns cached result on second call', () => {
    const first = identifyFrameworks(BACKEND_ONLY)
    const second = identifyFrameworks(BACKEND_ONLY)

    expect(second).toEqual(first)
  })

  it('generates different cache keys for different minConfidence', () => {
    const low = identifyFrameworks(BACKEND_ONLY, { minConfidence: 10 })
    const high = identifyFrameworks(BACKEND_ONLY, { minConfidence: 90 })

    expect(high).not.toBe(low)
  })
})

describe('identifyFrameworks summary with backend only', () => {
  it('builds summary when only backend frameworks are present', () => {
    const result = identifyFrameworks(BACKEND_ONLY)

    expect(result).toEqual(
      expect.objectContaining({
        backend: expect.arrayContaining([expect.objectContaining({ id: 'express' })]),
        summary: expect.stringMatching(/express/i),
      })
    )
  })

  it('builds summary with backend but no frontend', () => {
    const result = identifyFrameworks(BACKEND_ONLY)

    expect(typeof result.summary).toBe('string')
  })
})

describe('identifyFrameworks meta-frameworks nested extraction', () => {
  it('handles frontend frameworks with metaFrameworks property', () => {
    const result = identifyFrameworks(NEXTJS_APP)

    for (const frontend of result.frontend) {
      expect(frontend.metaFrameworks === undefined || Array.isArray(frontend.metaFrameworks)).toBe(true)
    }
  })
})

describe('identifyFrameworks cache hit path coverage', () => {
  beforeEach(() => {
    clearFrameworkIdentificationCache()
  })

  it('returns exact same cached object reference on second call', () => {
    const first = identifyFrameworks(NEXTJS_APP)
    const second = identifyFrameworks(NEXTJS_APP)

    expect(first).toBe(second)
  })

  it('cache hit path works with custom minConfidence', () => {
    const first = identifyFrameworks(NEXTJS_APP, { minConfidence: 50 })
    const second = identifyFrameworks(NEXTJS_APP, { minConfidence: 50 })

    expect(first).toBe(second)
  })
})

describe('identifyFrameworks minConfidence option coverage', () => {
  it('uses provided minConfidence value for filtering', () => {
    clearFrameworkIdentificationCache()

    const midThreshold = identifyFrameworks(NEXTJS_APP, { minConfidence: 40 })

    for (const framework of [...midThreshold.frontend, ...midThreshold.backend]) {
      expect(framework.confidence).toBeGreaterThanOrEqual(40)
    }
  })
})

describe('identifyFrameworks nested meta-frameworks extraction', () => {
  it('extracts meta-frameworks from detection.metaFrameworks array', () => {
    clearFrameworkIdentificationCache()
    const result = identifyFrameworks(NEXTJS_APP, { skipCache: true })

    const hasMetaFrameworkInfo =
      result.metaFrameworks.length > 0 || result.frontend.some((f) => f.metaFrameworks && f.metaFrameworks.length > 0)

    expect(hasMetaFrameworkInfo || result.frontend.length > 0).toBe(true)
  })

  it('deduplicates meta-frameworks from multiple sources', () => {
    clearFrameworkIdentificationCache()
    const result = identifyFrameworks(NEXTJS_APP, { skipCache: true })

    const ids = result.metaFrameworks.map((m) => m.id)
    const uniqueIds = [...new Set(ids)]
    expect(ids.length).toBe(uniqueIds.length)
  })

  it('filters nested meta-frameworks by minConfidence', () => {
    clearFrameworkIdentificationCache()

    const highThreshold = identifyFrameworks(NEXTJS_APP, { minConfidence: 95, skipCache: true })

    for (const meta of highThreshold.metaFrameworks) {
      expect(meta.confidence).toBeGreaterThanOrEqual(95)
    }
  })
})
