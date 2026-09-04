import { describe, expect, it } from '@hyperfrontend/testing'
import { createMockCommit, createMockContext } from './__test-utils__/generate-changelog-mocks'
import { createGenerateChangelogStep } from './generate-changelog'

describe('Write Changelog Step', () => {
  describe('execute - classification result', () => {
    function createMockRawCommit(hash = 'abc123') {
      return {
        hash,
        shortHash: hash.slice(0, 7),
        authorName: 'Test',
        authorEmail: 'test@test.com',
        authorDate: '2024-01-15T10:00:00Z',
        committerName: 'Test',
        committerEmail: 'test@test.com',
        commitDate: '2024-01-15T10:00:00Z',
        subject: 'test commit',
        body: '',
        message: 'test commit',
        parents: [],
        refs: [],
      }
    }

    function createMockSummary(overrides: Partial<{ total: number; included: number; excluded: number }> = {}) {
      return {
        total: overrides.total ?? 1,
        included: overrides.included ?? 1,
        excluded: overrides.excluded ?? 0,
        bySource: {
          'direct-scope': 0,
          'direct-file': 0,
          'unscoped-file': 0,
          'indirect-dependency': 0,
          'indirect-infra': 0,
          'unscoped-global': 0,
          excluded: 0,
        },
      }
    }

    function createClassifiedCommit(
      overrides: Partial<{
        type: string
        scope: readonly string[]
        subject: string
        breaking: boolean
        breakingDescription: string
        source: 'direct-scope' | 'direct-file' | 'unscoped-file' | 'indirect-dependency' | 'indirect-infra'
        include: boolean
        preserveScope: boolean
      }> = {}
    ) {
      const {
        type = 'feat',
        scope = [],
        subject = 'test feature',
        breaking = false,
        breakingDescription,
        source = 'direct-scope',
        include = true,
        preserveScope = source !== 'direct-scope',
      } = overrides

      return {
        commit: {
          type,
          scope,
          subject,
          breaking,
          breakingDescription,
          body: undefined,
          footers: [],
          raw: `${type}${scope.length > 0 ? `(${scope.join(',')})` : ''}: ${subject}`,
        },
        raw: createMockRawCommit(),
        source,
        include,
        preserveScope,
      }
    }

    it('uses classificationResult when available', async () => {
      const step = createGenerateChangelogStep()
      const directCommit = createClassifiedCommit({
        type: 'feat',
        scope: ['lib-test'],
        subject: 'add new feature',
        source: 'direct-scope',
      })

      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: ['lib-test'], subject: 'add new feature' })],
        classificationResult: {
          commits: [directCommit],
          included: [directCommit],
          excluded: [],
          summary: createMockSummary(),
        },
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const entry = result.stateUpdates?.changelogEntry
      expect(entry.sections.length).toBeGreaterThan(0)
    })

    it('omits scope for direct-scope commits (redundant)', async () => {
      const step = createGenerateChangelogStep()
      const directCommit = createClassifiedCommit({
        type: 'feat',
        scope: ['lib-test'],
        subject: 'add feature',
        source: 'direct-scope',
        preserveScope: false,
      })

      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: ['lib-test'], subject: 'add feature' })],
        classificationResult: {
          commits: [directCommit],
          included: [directCommit],
          excluded: [],
          summary: createMockSummary(),
        },
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      expect(featuresSection).toBeDefined()
      expect(featuresSection.items[0]).toEqual(expect.objectContaining({ scope: undefined, description: 'add feature' }))
    })

    it('preserves scope for direct-file commits (informative)', async () => {
      const step = createGenerateChangelogStep()
      const directFileCommit = createClassifiedCommit({
        type: 'feat',
        scope: ['lib-other'],
        subject: 'cross-project feature',
        source: 'direct-file',
        preserveScope: true,
      })

      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: ['lib-other'], subject: 'cross-project feature' })],
        classificationResult: {
          commits: [directFileCommit],
          included: [directFileCommit],
          excluded: [],
          summary: createMockSummary(),
        },
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      expect(featuresSection).toBeDefined()
      expect(featuresSection.items[0].scope).toBe('lib-other')
    })

    it('preserves scope for indirect-dependency commits', async () => {
      const step = createGenerateChangelogStep()
      const indirectCommit = createClassifiedCommit({
        type: 'feat',
        scope: ['lib-utils'],
        subject: 'utility improvement',
        source: 'indirect-dependency',
        preserveScope: true,
      })

      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: ['lib-utils'], subject: 'utility improvement' })],
        classificationResult: {
          commits: [indirectCommit],
          included: [indirectCommit],
          excluded: [],
          summary: createMockSummary(),
        },
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const depSection = entry.sections.find((s: { heading: string }) => s.heading === 'Dependency Updates')
      expect(depSection).toBeDefined()
      expect(depSection.items[0].scope).toBe('lib-utils')
    })

    it('creates Dependency Updates section for indirect commits', async () => {
      const step = createGenerateChangelogStep()
      const directCommit = createClassifiedCommit({
        type: 'feat',
        subject: 'direct feature',
        source: 'direct-scope',
      })
      const indirectCommit = createClassifiedCommit({
        type: 'fix',
        scope: ['lib-dep'],
        subject: 'dependency fix',
        source: 'indirect-dependency',
        preserveScope: true,
      })

      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [
          createMockCommit({ type: 'feat', subject: 'direct feature' }),
          createMockCommit({ type: 'fix', scope: ['lib-dep'], subject: 'dependency fix' }),
        ],
        classificationResult: {
          commits: [directCommit, indirectCommit],
          included: [directCommit, indirectCommit],
          excluded: [],
          summary: createMockSummary({ total: 2, included: 2 }),
        },
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      const depSection = entry.sections.find((s: { heading: string }) => s.heading === 'Dependency Updates')

      expect(featuresSection).toBeDefined()
      expect(depSection).toBeDefined()
      expect(depSection.items[0].scope).toBe('lib-dep')
    })

    it('sets indirect flag on ChangelogItem for indirect commits', async () => {
      const step = createGenerateChangelogStep()
      const indirectCommit = createClassifiedCommit({
        type: 'feat',
        scope: ['lib-infra'],
        subject: 'infra update',
        source: 'indirect-infra',
        preserveScope: true,
      })

      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: ['lib-infra'], subject: 'infra update' })],
        classificationResult: {
          commits: [indirectCommit],
          included: [indirectCommit],
          excluded: [],
          summary: createMockSummary(),
        },
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const depSection = entry.sections.find((s: { heading: string }) => s.heading === 'Dependency Updates')
      expect(depSection).toBeDefined()
      expect(depSection.items[0].indirect).toBe(true)
      expect(depSection.items[0].source).toBe('indirect-infra')
    })

    it('handles breaking changes with classification', async () => {
      const step = createGenerateChangelogStep()
      const breakingCommit = createClassifiedCommit({
        type: 'feat',
        scope: ['lib-test'],
        subject: 'major API change',
        breaking: true,
        breakingDescription: 'Removed deprecated method',
        source: 'direct-scope',
      })

      const ctx = createMockContext({
        nextVersion: '2.0.0',
        bumpType: 'major',
        commits: [
          createMockCommit({
            type: 'feat',
            scope: ['lib-test'],
            subject: 'major API change',
            breaking: true,
            breakingDescription: 'Removed deprecated method',
          }),
        ],
        classificationResult: {
          commits: [breakingCommit],
          included: [breakingCommit],
          excluded: [],
          summary: createMockSummary(),
        },
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const breakingSection = entry.sections.find((s: { type: string }) => s.type === 'breaking')
      expect(breakingSection).toBeDefined()
      expect(breakingSection.heading).toBe('Breaking Changes')
      expect(breakingSection.items[0].breaking).toBe(true)
    })

    it('falls back to commits without classification for backward compatibility', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: ['other'], subject: 'fallback feature' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const entry = result.stateUpdates?.changelogEntry
      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      expect(featuresSection).toBeDefined()
      expect(featuresSection.items[0].scope).toBe('other')
    })
  })
})
