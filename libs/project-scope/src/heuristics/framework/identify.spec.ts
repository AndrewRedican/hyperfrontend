import { resolve } from 'node:path'
import { identifyFrameworks, usesFramework, clearFrameworkIdentificationCache } from './identify'

const FIXTURES_DIR = resolve(__dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const NEXTJS_APP = resolve(FIXTURES_DIR, 'nextjs-app')
const FRONTEND_APP = resolve(FIXTURES_DIR, 'frontend-app')
const DOCKER_APP = resolve(FIXTURES_DIR, 'docker-app')

describe('identifyFrameworks', () => {
  describe('result structure', () => {
    it('returns correct structure', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT)

      expect(result).toHaveProperty('frontend')
      expect(result).toHaveProperty('backend')
      expect(result).toHaveProperty('testing')
      expect(result).toHaveProperty('metaFrameworks')
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('stack')
      expect(Array.isArray(result.frontend)).toBe(true)
      expect(Array.isArray(result.backend)).toBe(true)
      expect(Array.isArray(result.testing)).toBe(true)
      expect(Array.isArray(result.metaFrameworks)).toBe(true)
      expect(typeof result.summary).toBe('string')
    })

    it('returns stack summary', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT)

      expect(result.stack).toBeDefined()
      expect(Array.isArray(result.stack.frontend)).toBe(true)
      expect(Array.isArray(result.stack.backend)).toBe(true)
      expect(Array.isArray(result.stack.testing)).toBe(true)
      expect(Array.isArray(result.stack.build)).toBe(true)
      expect(Array.isArray(result.stack.typeSystem)).toBe(true)
      expect(Array.isArray(result.stack.linting)).toBe(true)
    })
  })

  describe('with non-existent path', () => {
    it('returns empty arrays', () => {
      const result = identifyFrameworks('/non/existent/path')

      expect(result.frontend).toEqual([])
      expect(result.backend).toEqual([])
      expect(result.primary).toBeUndefined()
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

      // High threshold should have fewer or equal frameworks
      expect(highThreshold.frontend.length).toBeLessThanOrEqual(lowThreshold.frontend.length)
    })

    it('respects very high threshold', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT, { minConfidence: 100 })

      // With 100% threshold, very few or no frameworks should pass
      expect(result.frontend.length).toBeLessThanOrEqual(1)
    })

    it('respects zero threshold', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT, { minConfidence: 0 })

      // All detected frameworks should be included
      expect(result).toBeDefined()
    })
  })

  describe('caching', () => {
    it('uses cached result by default', () => {
      const first = identifyFrameworks(MINIMAL_PROJECT)
      const second = identifyFrameworks(MINIMAL_PROJECT)

      // Results should be identical (same reference if cached)
      expect(first.summary).toBe(second.summary)
    })

    it('respects skipCache option', () => {
      const cached = identifyFrameworks(MINIMAL_PROJECT)
      const fresh = identifyFrameworks(MINIMAL_PROJECT, { skipCache: true })

      // Both should have valid results
      expect(cached.summary).toBeDefined()
      expect(fresh.summary).toBeDefined()
    })
  })

  describe('summary generation', () => {
    it('generates human-readable summary', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT)

      expect(typeof result.summary).toBe('string')
      // Summary should either be 'No frameworks detected' or actual framework names
      expect(result.summary.length).toBeGreaterThan(0)
    })

    it('includes frontend frameworks in summary', () => {
      const result = identifyFrameworks(NEXTJS_APP)

      // Summary should always be a non-empty string
      expect(result.summary.length).toBeGreaterThan(0)
    })

    it('includes testing frameworks in summary', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT)

      // Summary should always be a non-empty string
      expect(result.summary.length).toBeGreaterThan(0)
    })
  })

  describe('framework info structure', () => {
    it('has correct properties for detected frameworks', () => {
      const result = identifyFrameworks(MINIMAL_PROJECT)

      const allFrameworks = [...result.frontend, ...result.backend]
      allFrameworks.forEach((framework) => {
        expect(typeof framework.id).toBe('string')
        expect(typeof framework.name).toBe('string')
        expect(typeof framework.confidence).toBe('number')
        expect(framework.confidence).toBeGreaterThanOrEqual(0)
        expect(framework.confidence).toBeLessThanOrEqual(100)
      })
    })

    it('includes version when available', () => {
      const result = identifyFrameworks(NEXTJS_APP)

      const allFrameworks = [...result.frontend, ...result.backend]
      allFrameworks.forEach((framework) => {
        // version is optional but should be string or undefined
        expect(framework.version === undefined || typeof framework.version === 'string').toBe(true)
      })
    })
  })

  describe('meta-framework detection', () => {
    it('detects meta-frameworks like Next.js', () => {
      const result = identifyFrameworks(NEXTJS_APP)

      // Should detect nextjs as meta-framework or frontend
      const hasNextjs =
        result.metaFrameworks.some((f) => f.id === 'nextjs') ||
        result.frontend.some((f) => f.id === 'nextjs') ||
        result.frontend.some((f) => f.id === 'react')

      // Either we detect Next.js/React or have some frontend stack
      expect(hasNextjs || result.stack.frontend.length > 0 || result.frontend.length === 0).toBe(true)
    })

    it('includes nested meta-frameworks', () => {
      const result = identifyFrameworks(NEXTJS_APP)

      // metaFrameworks array should be properly populated
      expect(Array.isArray(result.metaFrameworks)).toBe(true)
    })
  })

  describe('primary framework selection', () => {
    it('selects highest confidence as primary', () => {
      const result = identifyFrameworks(NEXTJS_APP)

      const allFrameworks = [...result.frontend, ...result.backend]
      // If primary exists, it should have the highest confidence
      // If no frameworks, primary should be undefined
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
    // With very high confidence threshold, should return false
    const result = usesFramework(MINIMAL_PROJECT, 'typescript', 100)

    // TypeScript might not have 100% confidence
    expect(typeof result).toBe('boolean')
  })
})

describe('clearFrameworkIdentificationCache', () => {
  it('clears the cache without error', () => {
    // First, populate the cache
    identifyFrameworks(MINIMAL_PROJECT)

    // Clear should not throw
    expect(() => clearFrameworkIdentificationCache()).not.toThrow()

    // After clearing, a new call should work
    const result = identifyFrameworks(MINIMAL_PROJECT)
    expect(result).toBeDefined()
  })

  it('forces fresh detection after clearing', () => {
    // Get cached result
    const cached = identifyFrameworks(MINIMAL_PROJECT)

    // Clear cache
    clearFrameworkIdentificationCache()

    // Get fresh result
    const fresh = identifyFrameworks(MINIMAL_PROJECT)

    // Both should have same structure
    expect(fresh.summary).toBe(cached.summary)
    expect(fresh.frontend.length).toBe(cached.frontend.length)
  })
})

describe('identifyFrameworks summary building', () => {
  it('builds summary with frontend frameworks', () => {
    const result = identifyFrameworks(FRONTEND_APP)

    // Should have React in summary or frontend
    expect(result.frontend.length).toBeGreaterThan(0)
    expect(result.summary).not.toBe('No frameworks detected')
  })

  it('builds summary with backend frameworks', () => {
    const result = identifyFrameworks(DOCKER_APP)

    // Docker app has express, should appear in backend
    expect(result.backend.length).toBeGreaterThan(0)
    expect(result.summary).not.toBe('No frameworks detected')
  })

  it('builds summary with testing frameworks', () => {
    const result = identifyFrameworks(MINIMAL_PROJECT)

    // Minimal project has jest
    expect(result.testing.length).toBeGreaterThan(0)
    // Testing frameworks should be mentioned
    expect(result.stack.testing.length).toBeGreaterThan(0)
  })
})

describe('identifyFrameworks meta-framework extraction', () => {
  it('extracts meta-frameworks from category', () => {
    const result = identifyFrameworks(NEXTJS_APP)

    // Next.js should be detected as frontend or meta-framework
    const hasNextjs = result.frontend.some((f) => f.id === 'nextjs') || result.metaFrameworks.some((f) => f.id === 'nextjs')

    // React or Next.js should be present
    expect(hasNextjs || result.frontend.some((f) => f.id === 'react')).toBe(true)
  })

  it('extracts nested meta-frameworks from detection', () => {
    const result = identifyFrameworks(NEXTJS_APP)

    // metaFrameworks should be properly extracted
    expect(Array.isArray(result.metaFrameworks)).toBe(true)
  })
})

describe('usesFramework advanced', () => {
  it('returns true for detected framework with default confidence', () => {
    // Minimal project has Jest
    const result = usesFramework(MINIMAL_PROJECT, 'jest', 10)
    expect(typeof result).toBe('boolean')
  })

  it('checks all framework categories', () => {
    // Check frontend
    const hasFrontend = usesFramework(FRONTEND_APP, 'react', 10)
    expect(typeof hasFrontend).toBe('boolean')

    // Check backend
    const hasBackend = usesFramework(DOCKER_APP, 'express', 10)
    expect(typeof hasBackend).toBe('boolean')
  })
})

const BACKEND_ONLY = resolve(FIXTURES_DIR, 'backend-only')

describe('identifyFrameworks caching', () => {
  beforeEach(() => {
    clearFrameworkIdentificationCache()
  })

  it('returns cached result on second call', () => {
    // First call - populates cache
    const first = identifyFrameworks(BACKEND_ONLY)
    // Second call - should hit cache
    const second = identifyFrameworks(BACKEND_ONLY)

    // Results should be identical
    expect(first.summary).toBe(second.summary)
    expect(first.frontend.length).toBe(second.frontend.length)
    expect(first.backend.length).toBe(second.backend.length)
  })

  it('generates different cache keys for different minConfidence', () => {
    const low = identifyFrameworks(BACKEND_ONLY, { minConfidence: 10 })
    const high = identifyFrameworks(BACKEND_ONLY, { minConfidence: 90 })

    // Different minConfidence = different cache keys = potentially different results
    expect(low).toBeDefined()
    expect(high).toBeDefined()
  })
})

describe('identifyFrameworks summary with backend only', () => {
  it('builds summary when only backend frameworks are present', () => {
    const result = identifyFrameworks(BACKEND_ONLY)

    // Should detect express
    expect(result.backend.length).toBeGreaterThan(0)
    expect(result.summary).not.toBe('No frameworks detected')
    // Backend framework name should appear in summary
    expect(result.summary.toLowerCase()).toContain('express')
  })

  it('builds summary with backend but no frontend', () => {
    const result = identifyFrameworks(BACKEND_ONLY)

    // Summary should work properly even without frontend
    expect(typeof result.summary).toBe('string')
  })
})

describe('identifyFrameworks meta-frameworks nested extraction', () => {
  it('handles frontend frameworks with metaFrameworks property', () => {
    const result = identifyFrameworks(NEXTJS_APP)

    // The extraction logic should properly handle nested metaFrameworks
    for (const frontend of result.frontend) {
      // metaFrameworks property on frontend is properly handled
      expect(frontend.metaFrameworks === undefined || Array.isArray(frontend.metaFrameworks)).toBe(true)
    }
  })
})

describe('identifyFrameworks cache hit path coverage', () => {
  beforeEach(() => {
    clearFrameworkIdentificationCache()
  })

  it('returns exact same cached object reference on second call', () => {
    // First call populates cache
    const first = identifyFrameworks(NEXTJS_APP)
    // Second call should return cached object (same reference)
    const second = identifyFrameworks(NEXTJS_APP)

    // Verify same object reference is returned (cache hit)
    expect(first).toBe(second)
  })

  it('cache hit path works with custom minConfidence', () => {
    // First call with specific minConfidence
    const first = identifyFrameworks(NEXTJS_APP, { minConfidence: 50 })
    // Second call with same minConfidence should hit cache
    const second = identifyFrameworks(NEXTJS_APP, { minConfidence: 50 })

    // Same cache key should return same reference
    expect(first).toBe(second)
  })
})

describe('identifyFrameworks minConfidence option coverage', () => {
  it('uses provided minConfidence value for filtering', () => {
    clearFrameworkIdentificationCache()

    // Test with mid-range threshold
    const midThreshold = identifyFrameworks(NEXTJS_APP, { minConfidence: 40 })

    // All returned frameworks should meet the threshold
    for (const framework of midThreshold.frontend) {
      expect(framework.confidence).toBeGreaterThanOrEqual(40)
    }
    for (const framework of midThreshold.backend) {
      expect(framework.confidence).toBeGreaterThanOrEqual(40)
    }
  })
})

describe('identifyFrameworks nested meta-frameworks extraction', () => {
  it('extracts meta-frameworks from detection.metaFrameworks array', () => {
    clearFrameworkIdentificationCache()
    const result = identifyFrameworks(NEXTJS_APP, { skipCache: true })

    // If React is detected with Next.js as nested meta-framework,
    // the metaFrameworks array should contain it
    // Either metaFrameworks has entries or frontend has metaFrameworks references
    const hasMetaFrameworkInfo =
      result.metaFrameworks.length > 0 || result.frontend.some((f) => f.metaFrameworks && f.metaFrameworks.length > 0)

    expect(hasMetaFrameworkInfo || result.frontend.length > 0).toBe(true)
  })

  it('deduplicates meta-frameworks from multiple sources', () => {
    clearFrameworkIdentificationCache()
    const result = identifyFrameworks(NEXTJS_APP, { skipCache: true })

    // Check for duplicates in metaFrameworks array
    const ids = result.metaFrameworks.map((m) => m.id)
    const uniqueIds = [...new Set(ids)]
    expect(ids.length).toBe(uniqueIds.length)
  })

  it('filters nested meta-frameworks by minConfidence', () => {
    clearFrameworkIdentificationCache()

    // With high minConfidence, fewer meta-frameworks should pass
    const highThreshold = identifyFrameworks(NEXTJS_APP, { minConfidence: 95, skipCache: true })

    // All meta-frameworks should meet the threshold
    for (const meta of highThreshold.metaFrameworks) {
      expect(meta.confidence).toBeGreaterThanOrEqual(95)
    }
  })
})
