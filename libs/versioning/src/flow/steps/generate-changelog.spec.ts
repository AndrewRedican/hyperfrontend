import { createMockCommit, createMockContext } from './__test-utils__/generate-changelog-mocks'
import { createGenerateChangelogStep, GENERATE_CHANGELOG_STEP_ID } from './generate-changelog'

describe('Generate Changelog Step', () => {
  describe('createGenerateChangelogStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createGenerateChangelogStep()

      expect(step.id).toBe(GENERATE_CHANGELOG_STEP_ID)
      expect(step.id).toBe('generate-changelog')
      expect(step.name).toBe('Generate Changelog Entry')
    })

    it('depends on check-idempotency step', () => {
      const step = createGenerateChangelogStep()

      expect(step.dependsOn).toContain('check-idempotency')
    })
  })

  describe('execute - skip conditions', () => {
    it('skips when no bump needed (no nextVersion)', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({ bumpType: 'none', nextVersion: undefined })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('No version bump')
    })

    it('skips when bumpType is none', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'none' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })

    it('skips when changelog disabled', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { skipChangelog: true })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('Changelog generation disabled')
    })
  })

  describe('execute - initial release', () => {
    it('generates initial release entry when no commits', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry).toBeDefined()
      expect(result.stateUpdates?.changelogEntry.version).toBe('1.0.0')
      expect(result.message).toContain('initial release')
    })

    it('announces a stable promotion when a published 0.x line reaches 1.0.0', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'major',
        commits: [],
        publishedVersion: '0.2.1',
        isFirstRelease: false,
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.message).toContain('stable promotion')

      const entry = result.stateUpdates?.changelogEntry
      expect(entry.version).toBe('1.0.0')
      expect(entry.sections[0].heading).toBe('Features')
      expect(entry.sections[0].items[0].description).toBe('Marked stable. No API changes since 0.2.1.')
    })

    it('records a plain no-change release when the version does not cross into 1.0.0', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.2.4',
        bumpType: 'patch',
        commits: [],
        publishedVersion: '1.2.3',
        isFirstRelease: false,
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.message).toContain('no-change')

      const entry = result.stateUpdates?.changelogEntry
      expect(entry.sections[0].heading).toBe('Other')
      expect(entry.sections[0].items[0].description).toBe('Released with no functional changes since 1.2.3.')
    })

    it('records a plain no-change release when a 0.x line stays below 1.0.0', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '0.3.0',
        bumpType: 'minor',
        commits: [],
        publishedVersion: '0.2.1',
        isFirstRelease: false,
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.message).toContain('no-change')
      expect(result.stateUpdates?.changelogEntry.sections[0].items[0].description).toBe('Released with no functional changes since 0.2.1.')
    })

    it('generates initial release entry when commits is undefined', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '0.1.0',
        bumpType: 'minor',
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry).toBeDefined()
    })
  })

  describe('execute - commit grouping', () => {
    it('groups commits by type into sections', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.1.0',
        bumpType: 'minor',
        commits: [
          createMockCommit({ type: 'feat', subject: 'feature 1' }),
          createMockCommit({ type: 'feat', subject: 'feature 2' }),
          createMockCommit({ type: 'fix', subject: 'bug fix' }),
        ],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const entry = result.stateUpdates?.changelogEntry
      expect(entry.sections.length).toBeGreaterThanOrEqual(2)

      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      const fixesSection = entry.sections.find((s: { type: string }) => s.type === 'fixes')

      expect(featuresSection?.items).toHaveLength(2)
      expect(fixesSection?.items).toHaveLength(1)
    })

    it('includes commit scope in changelog item', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: ['api'], subject: 'new endpoint' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const featSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      expect(featSection?.items[0].description).toContain('**api:**')
    })
  })

  describe('execute - breaking changes', () => {
    it('adds breaking changes section first', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '2.0.0',
        bumpType: 'major',
        commits: [
          createMockCommit({ type: 'feat', subject: 'breaking feature', breaking: true }),
          createMockCommit({ type: 'fix', subject: 'normal fix' }),
        ],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      expect(entry.sections[0].type).toBe('breaking')
      expect(entry.sections[0].heading).toBe('Breaking Changes')
    })

    it('uses breakingDescription when available', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '2.0.0',
        bumpType: 'major',
        commits: [
          createMockCommit({
            type: 'feat',
            subject: 'refactor API',
            breaking: true,
            breakingDescription: 'API signature changed',
          }),
        ],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const breakingSection = entry.sections.find((s: { type: string }) => s.type === 'breaking')
      expect(breakingSection?.items[0].description).toContain('API signature changed')
    })

    it('includes scope in breaking change item', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '2.0.0',
        bumpType: 'major',
        commits: [
          createMockCommit({
            type: 'feat',
            scope: ['core'],
            subject: 'breaking change',
            breaking: true,
          }),
        ],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const breakingSection = entry.sections.find((s: { type: string }) => s.type === 'breaking')
      expect(breakingSection?.items[0].description).toContain('**core:**')
    })

    it('flags breaking feature items', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '2.0.0',
        bumpType: 'major',
        commits: [
          createMockCommit({
            type: 'feat',
            subject: 'breaking feature',
            breaking: true,
          }),
        ],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      expect(featuresSection?.items[0]).toEqual(expect.objectContaining({ description: 'breaking feature', breaking: true }))
    })
  })

  describe('execute - commit type mapping', () => {
    it('maps perf to performance section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.1',
        bumpType: 'patch',
        commits: [createMockCommit({ type: 'perf', subject: 'faster loading' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const perfSection = entry.sections.find((s: { type: string }) => s.type === 'performance')
      expect(perfSection).toBeDefined()
    })

    it('maps docs to documentation section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'docs', subject: 'update readme' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const docsSection = entry.sections.find((s: { type: string }) => s.type === 'documentation')
      expect(docsSection).toBeDefined()
    })

    it('maps chore to chores section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'chore', subject: 'update deps' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const choresSection = entry.sections.find((s: { type: string }) => s.type === 'chores')
      expect(choresSection).toBeDefined()
    })

    it('maps unknown types to chores', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'custom', subject: 'custom commit' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const choresSection = entry.sections.find((s: { type: string }) => s.type === 'chores')
      expect(choresSection).toBeDefined()
    })

    it('maps refactor to refactoring section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'refactor', subject: 'simplify logic' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const refactorSection = entry.sections.find((s: { type: string }) => s.type === 'refactoring')
      expect(refactorSection).toBeDefined()
      expect(refactorSection?.heading).toBe('Code Refactoring')
    })

    it('maps revert to other section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'revert', subject: 'revert previous change' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const otherSection = entry.sections.find((s: { type: string }) => s.type === 'other')
      expect(otherSection).toBeDefined()
    })

    it('maps build to build section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'build', subject: 'update build config' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const buildSection = entry.sections.find((s: { type: string }) => s.type === 'build')
      expect(buildSection).toBeDefined()
    })

    it('maps ci to ci section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'ci', subject: 'add workflow' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const ciSection = entry.sections.find((s: { type: string }) => s.type === 'ci')
      expect(ciSection).toBeDefined()
      expect(ciSection?.heading).toBe('Continuous Integration')
    })

    it('maps test to tests section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'test', subject: 'add unit tests' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const testsSection = entry.sections.find((s: { type: string }) => s.type === 'tests')
      expect(testsSection).toBeDefined()
    })

    it('maps style to other section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'style', subject: 'format code' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const otherSection = entry.sections.find((s: { type: string }) => s.type === 'other')
      expect(otherSection).toBeDefined()
    })

    it('defaults to chores when commit type is undefined', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [{ ...createMockCommit(), type: undefined as unknown as string }],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const choresSection = entry.sections.find((s: { type: string }) => s.type === 'chores')
      expect(choresSection).toBeDefined()
    })

    it('uses default mapping when commitTypeToSection is undefined', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext(
        {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          commits: [createMockCommit({ type: 'chore', subject: 'update deps' })],
        },
        { commitTypeToSection: undefined }
      )

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const choresSection = entry.sections.find((s: { type: string }) => s.type === 'chores')
      expect(choresSection).toBeDefined()
    })

    it('overrides existing mapping via config', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext(
        {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          commits: [createMockCommit({ type: 'chore', subject: 'update deps' })],
        },
        { commitTypeToSection: { chore: 'other' } }
      )

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const otherSection = entry.sections.find((s: { type: string }) => s.type === 'other')
      expect(otherSection).toBeDefined()
      const choresSection = entry.sections.find((s: { type: string }) => s.type === 'chores')
      expect(choresSection).toBeUndefined()
    })

    it('adds custom commit type via config', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext(
        {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          commits: [createMockCommit({ type: 'wip', subject: 'work in progress' })],
        },
        { commitTypeToSection: { wip: 'other' } }
      )

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const otherSection = entry.sections.find((s: { type: string }) => s.type === 'other')
      expect(otherSection).toBeDefined()
    })

    it('excludes commit type when mapped to null', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext(
        {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          commits: [
            createMockCommit({ type: 'feat', subject: 'new feature' }),
            createMockCommit({ type: 'docs', subject: 'update readme' }),
          ],
        },
        { commitTypeToSection: { docs: null } }
      )

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const docsSection = entry.sections.find((s: { type: string }) => s.type === 'documentation')
      expect(docsSection).toBeUndefined()
      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      expect(featuresSection).toBeDefined()
    })

    it('falls back to chores for unmapped custom type without config', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext(
        {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          commits: [createMockCommit({ type: 'experiment', subject: 'try something' })],
        },
        { commitTypeToSection: { wip: 'other' } }
      )

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const choresSection = entry.sections.find((s: { type: string }) => s.type === 'chores')
      expect(choresSection).toBeDefined()
    })
  })

  describe('execute - section ordering', () => {
    it('orders sections by conventional format', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [
          createMockCommit({ type: 'chore', subject: 'chore' }),
          createMockCommit({ type: 'feat', subject: 'feature' }),
          createMockCommit({ type: 'fix', subject: 'fix' }),
          createMockCommit({ type: 'docs', subject: 'docs' }),
        ],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const types = entry.sections.map((s: { type: string }) => s.type)

      expect(types.indexOf('features')).toBeLessThan(types.indexOf('fixes'))
      expect(types.indexOf('fixes')).toBeLessThan(types.indexOf('documentation'))
      expect(types.indexOf('documentation')).toBeLessThan(types.indexOf('chores'))
    })
  })

  describe('execute - success message', () => {
    it('includes section and commit counts in message', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [
          createMockCommit({ type: 'feat', subject: 'f1' }),
          createMockCommit({ type: 'feat', subject: 'f2' }),
          createMockCommit({ type: 'fix', subject: 'fix' }),
        ],
      })

      const result = await step.execute(ctx)

      expect(result.message).toMatch(/\d+ section\(s\)/)
      expect(result.message).toMatch(/\d+ commit\(s\)/)
    })
  })
})
