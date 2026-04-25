import { createGitCommit } from '../../git/models/commit'
import { createConventionalCommit } from '../models/conventional'
import { createClassifiedCommit, createEmptyClassificationSummary } from './models'

describe('createEmptyClassificationSummary', () => {
  it('creates a summary with all counts at zero', () => {
    const summary = createEmptyClassificationSummary()

    expect(summary.total).toBe(0)
    expect(summary.included).toBe(0)
    expect(summary.excluded).toBe(0)
    expect(summary.bySource['direct-scope']).toBe(0)
    expect(summary.bySource['direct-file']).toBe(0)
    expect(summary.bySource['unscoped-file']).toBe(0)
    expect(summary.bySource['indirect-dependency']).toBe(0)
    expect(summary.bySource['indirect-infra']).toBe(0)
    expect(summary.bySource['unscoped-global']).toBe(0)
    expect(summary.bySource['excluded']).toBe(0)
  })
})

describe('createClassifiedCommit', () => {
  const commit = createConventionalCommit('feat', 'add feature', { scope: ['versioning'] })
  const raw = createGitCommit({
    hash: 'abc123def456789012345678901234567890abcd',
    authorName: 'Test Author',
    authorEmail: 'test@example.com',
    authorDate: '2026-03-17T10:00:00Z',
    subject: 'feat(versioning): add feature',
  })

  describe('direct-scope source', () => {
    it('sets include to true', () => {
      const classified = createClassifiedCommit(commit, raw, 'direct-scope')
      expect(classified.include).toBe(true)
    })

    it('sets preserveScope to false', () => {
      const classified = createClassifiedCommit(commit, raw, 'direct-scope')
      expect(classified.preserveScope).toBe(false)
    })
  })

  describe('direct-file source', () => {
    it('sets include to true', () => {
      const classified = createClassifiedCommit(commit, raw, 'direct-file')
      expect(classified.include).toBe(true)
    })

    it('sets preserveScope to true', () => {
      const classified = createClassifiedCommit(commit, raw, 'direct-file')
      expect(classified.preserveScope).toBe(true)
    })
  })

  describe('unscoped-file source', () => {
    it('sets include to true', () => {
      const classified = createClassifiedCommit(commit, raw, 'unscoped-file')
      expect(classified.include).toBe(true)
    })

    it('sets preserveScope to false', () => {
      const classified = createClassifiedCommit(commit, raw, 'unscoped-file')
      expect(classified.preserveScope).toBe(false)
    })
  })

  describe('indirect-dependency source', () => {
    it('sets include to true', () => {
      const classified = createClassifiedCommit(commit, raw, 'indirect-dependency')
      expect(classified.include).toBe(true)
    })

    it('sets preserveScope to true', () => {
      const classified = createClassifiedCommit(commit, raw, 'indirect-dependency')
      expect(classified.preserveScope).toBe(true)
    })

    it('can include dependency path', () => {
      const classified = createClassifiedCommit(commit, raw, 'indirect-dependency', {
        dependencyPath: ['lib-utils', 'lib-core'],
      })
      expect(classified.dependencyPath).toEqual(['lib-utils', 'lib-core'])
    })
  })

  describe('indirect-infra source', () => {
    it('sets include to true', () => {
      const classified = createClassifiedCommit(commit, raw, 'indirect-infra')
      expect(classified.include).toBe(true)
    })

    it('sets preserveScope to true', () => {
      const classified = createClassifiedCommit(commit, raw, 'indirect-infra')
      expect(classified.preserveScope).toBe(true)
    })
  })

  describe('unscoped-global source', () => {
    it('sets include to false', () => {
      const classified = createClassifiedCommit(commit, raw, 'unscoped-global')
      expect(classified.include).toBe(false)
    })
  })

  describe('excluded source', () => {
    it('sets include to false', () => {
      const classified = createClassifiedCommit(commit, raw, 'excluded')
      expect(classified.include).toBe(false)
    })
  })

  describe('optional fields', () => {
    it('includes touchedFiles when provided', () => {
      const classified = createClassifiedCommit(commit, raw, 'direct-file', {
        touchedFiles: ['src/index.ts', 'src/utils.ts'],
      })
      expect(classified.touchedFiles).toEqual(['src/index.ts', 'src/utils.ts'])
    })

    it('includes dependencyPath when provided', () => {
      const classified = createClassifiedCommit(commit, raw, 'indirect-dependency', {
        dependencyPath: ['lib-utils'],
      })
      expect(classified.dependencyPath).toEqual(['lib-utils'])
    })
  })
})
