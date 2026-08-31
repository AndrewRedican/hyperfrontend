import type { RepositoryConfig } from '../../repository/models'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createMockCommit, createMockContext } from './__test-utils__/generate-changelog-mocks'
import { createGenerateChangelogStep } from './generate-changelog'

describe('Generate Changelog Step', () => {
  describe('execute - compare URL generation', () => {
    // Note: Compare URLs now use commit hashes only (not tags)

    const createGitHubConfig = (): RepositoryConfig => ({
      platform: 'github',
      baseUrl: 'https://github.com/owner/repo',
    })

    const createGitLabConfig = (): RepositoryConfig => ({
      platform: 'gitlab',
      baseUrl: 'https://gitlab.com/group/project',
    })

    const createBitbucketConfig = (): RepositoryConfig => ({
      platform: 'bitbucket',
      baseUrl: 'https://bitbucket.org/owner/repo',
    })

    it('does not include compareUrl when repositoryConfig is not present', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        effectiveBaseCommit: 'def456789',
        commits: [createMockCommit({ type: 'feat', subject: 'new feature' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBeUndefined()
    })

    it('does not include compareUrl when effectiveBaseCommit is not present', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        repositoryConfig: createGitHubConfig(),
        commits: [createMockCommit({ type: 'feat', subject: 'new feature' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBeUndefined()
    })

    it('does not include compareUrl when effectiveBaseCommit is null', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        repositoryConfig: createGitHubConfig(),
        effectiveBaseCommit: null,
        commits: [createMockCommit({ type: 'feat', subject: 'new feature' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBeUndefined()
    })

    it('logs info when publishedCommit exists but effectiveBaseCommit is null (fallback mode)', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        repositoryConfig: createGitHubConfig(),
        publishedCommit: 'orphaned123',
        effectiveBaseCommit: null,
        commits: [createMockCommit({ type: 'feat', subject: 'new feature' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBeUndefined()
      expect(ctx.logger.info).toHaveBeenCalledWith('Compare URL omitted: published commit not in current history')
    })

    it('generates GitHub compareUrl using commit hashes when effectiveBaseCommit exists', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.1.0',
        bumpType: 'minor',
        repositoryConfig: createGitHubConfig(),
        effectiveBaseCommit: 'def456789',
        commits: [createMockCommit({ type: 'feat', subject: 'new feature' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBe('https://github.com/owner/repo/compare/def456789...abc123')
    })

    it('generates GitLab compareUrl with /-/ prefix using commit hashes', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '2.0.0',
        bumpType: 'major',
        repositoryConfig: createGitLabConfig(),
        effectiveBaseCommit: 'def456789',
        commits: [createMockCommit({ type: 'feat', subject: 'breaking change', breaking: true })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBe('https://gitlab.com/group/project/-/compare/def456789...abc123')
    })

    it('generates Bitbucket compareUrl with reversed order and two dots using commit hashes', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.1',
        bumpType: 'patch',
        repositoryConfig: createBitbucketConfig(),
        effectiveBaseCommit: 'def456789',
        commits: [createMockCommit({ type: 'fix', subject: 'bug fix' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBe('https://bitbucket.org/owner/repo/compare/abc123..def456789')
    })

    it('handles initial release path with repositoryConfig but no commits', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '0.1.0',
        bumpType: 'minor',
        repositoryConfig: createGitHubConfig(),
        commits: [],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.message).toContain('initial release')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBeUndefined()
    })

    it('generates compareUrl for version reset scenario (empty commits but has effectiveBaseCommit)', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'major',
        repositoryConfig: createGitHubConfig(),
        effectiveBaseCommit: 'def456789',
        commits: [],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBe('https://github.com/owner/repo/compare/def456789...abc123')
    })

    it('uses custom formatter when platform is custom', async () => {
      const step = createGenerateChangelogStep()
      const customConfig: RepositoryConfig = {
        platform: 'custom',
        baseUrl: 'https://my-git.internal/repo',
        formatCompareUrl: (from, to) => `https://my-git.internal/diff/${from}/${to}`,
      }
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        repositoryConfig: customConfig,
        effectiveBaseCommit: 'def456789',
        commits: [createMockCommit({ type: 'feat', subject: 'feature' })],
      })

      const result = await step.execute(ctx)

      expect(result.stateUpdates?.changelogEntry.compareUrl).toBe('https://my-git.internal/diff/def456789/abc123')
    })

    it('logs debug message with abbreviated commit hashes when generating compareUrl', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        repositoryConfig: createGitHubConfig(),
        effectiveBaseCommit: 'def456789abcdef',
        commits: [createMockCommit({ type: 'feat', subject: 'feature' })],
      })

      await step.execute(ctx)

      expect(ctx.logger.debug).toHaveBeenCalledWith('Compare URL: def4567...abc123')
    })
  })
})
