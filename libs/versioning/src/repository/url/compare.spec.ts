import type { RepositoryConfig } from '../models/repository-config'
import { createCompareUrl } from './compare'

describe('createCompareUrl', () => {
  describe('GitHub', () => {
    const repository: RepositoryConfig = {
      platform: 'github',
      baseUrl: 'https://github.com/owner/repo',
    }

    it('creates compare URL with three dots', () => {
      const url = createCompareUrl({
        repository,
        fromTag: 'v1.0.0',
        toTag: 'v1.1.0',
      })

      expect(url).toBe('https://github.com/owner/repo/compare/v1.0.0...v1.1.0')
    })

    it('handles tags without v prefix', () => {
      const url = createCompareUrl({
        repository,
        fromTag: '1.0.0',
        toTag: '1.1.0',
      })

      expect(url).toBe('https://github.com/owner/repo/compare/1.0.0...1.1.0')
    })

    it('handles complex tag formats', () => {
      const url = createCompareUrl({
        repository,
        fromTag: 'lib-versioning@0.0.4',
        toTag: 'lib-versioning@0.1.0',
      })

      expect(url).toBe('https://github.com/owner/repo/compare/lib-versioning@0.0.4...lib-versioning@0.1.0')
    })
  })

  describe('GitLab', () => {
    const repository: RepositoryConfig = {
      platform: 'gitlab',
      baseUrl: 'https://gitlab.com/group/project',
    }

    it('creates compare URL with /-/ prefix and three dots', () => {
      const url = createCompareUrl({
        repository,
        fromTag: 'v1.0.0',
        toTag: 'v1.1.0',
      })

      expect(url).toBe('https://gitlab.com/group/project/-/compare/v1.0.0...v1.1.0')
    })

    it('handles nested groups', () => {
      const nestedRepo: RepositoryConfig = {
        platform: 'gitlab',
        baseUrl: 'https://gitlab.com/group/subgroup/project',
      }

      const url = createCompareUrl({
        repository: nestedRepo,
        fromTag: 'v1.0.0',
        toTag: 'v1.1.0',
      })

      expect(url).toBe('https://gitlab.com/group/subgroup/project/-/compare/v1.0.0...v1.1.0')
    })

    it('handles self-hosted GitLab', () => {
      const selfHostedRepo: RepositoryConfig = {
        platform: 'gitlab',
        baseUrl: 'https://gitlab.mycompany.com/team/project',
      }

      const url = createCompareUrl({
        repository: selfHostedRepo,
        fromTag: 'v1.0.0',
        toTag: 'v1.1.0',
      })

      expect(url).toBe('https://gitlab.mycompany.com/team/project/-/compare/v1.0.0...v1.1.0')
    })
  })

  describe('Bitbucket', () => {
    const repository: RepositoryConfig = {
      platform: 'bitbucket',
      baseUrl: 'https://bitbucket.org/owner/repo',
    }

    it('creates compare URL with reversed order and two dots', () => {
      const url = createCompareUrl({
        repository,
        fromTag: 'v1.0.0',
        toTag: 'v1.1.0',
      })

      // Bitbucket uses reversed order: toTag..fromTag
      expect(url).toBe('https://bitbucket.org/owner/repo/compare/v1.1.0..v1.0.0')
    })

    it('handles complex tags with reversed order', () => {
      const url = createCompareUrl({
        repository,
        fromTag: 'release-1.0.0',
        toTag: 'release-1.1.0',
      })

      expect(url).toBe('https://bitbucket.org/owner/repo/compare/release-1.1.0..release-1.0.0')
    })
  })

  describe('Azure DevOps', () => {
    const repository: RepositoryConfig = {
      platform: 'azure-devops',
      baseUrl: 'https://dev.azure.com/org/project/_git/repo',
    }

    it('creates compare URL with query parameters and GT prefix', () => {
      const url = createCompareUrl({
        repository,
        fromTag: 'v1.0.0',
        toTag: 'v1.1.0',
      })

      expect(url).toBe('https://dev.azure.com/org/project/_git/repo/compare?version=GTv1.1.0&compareVersion=GTv1.0.0')
    })

    it('URL-encodes special characters in tags', () => {
      const url = createCompareUrl({
        repository,
        fromTag: 'release/1.0.0',
        toTag: 'release/1.1.0',
      })

      // Slashes should be encoded
      expect(url).toBe('https://dev.azure.com/org/project/_git/repo/compare?version=GTrelease%2F1.1.0&compareVersion=GTrelease%2F1.0.0')
    })

    it('handles tags with @ symbol', () => {
      const url = createCompareUrl({
        repository,
        fromTag: 'lib-versioning@0.0.4',
        toTag: 'lib-versioning@0.1.0',
      })

      // @ should be encoded as %40
      expect(url).toBe(
        'https://dev.azure.com/org/project/_git/repo/compare?version=GTlib-versioning%400.1.0&compareVersion=GTlib-versioning%400.0.4'
      )
    })

    it('handles legacy visualstudio.com URLs', () => {
      const legacyRepo: RepositoryConfig = {
        platform: 'azure-devops',
        baseUrl: 'https://myorg.visualstudio.com/project/_git/repo',
      }

      const url = createCompareUrl({
        repository: legacyRepo,
        fromTag: 'v1.0.0',
        toTag: 'v1.1.0',
      })

      expect(url).toBe('https://myorg.visualstudio.com/project/_git/repo/compare?version=GTv1.1.0&compareVersion=GTv1.0.0')
    })
  })

  describe('Custom platform', () => {
    it('uses formatCompareUrl when provided', () => {
      const repository: RepositoryConfig = {
        platform: 'custom',
        baseUrl: 'https://my-git.internal/repo',
        formatCompareUrl: (from, to) => `https://my-git.internal/diff/${from}/${to}`,
      }

      const url = createCompareUrl({
        repository,
        fromTag: 'v1.0.0',
        toTag: 'v1.1.0',
      })

      expect(url).toBe('https://my-git.internal/diff/v1.0.0/v1.1.0')
    })

    it('returns null for custom platform without formatter', () => {
      const repository: RepositoryConfig = {
        platform: 'custom',
        baseUrl: 'https://my-git.internal/repo',
      }

      const url = createCompareUrl({
        repository,
        fromTag: 'v1.0.0',
        toTag: 'v1.1.0',
      })

      expect(url).toBeNull()
    })
  })

  describe('Platform with custom formatter override', () => {
    it('uses formatCompareUrl over built-in formatter', () => {
      const repository: RepositoryConfig = {
        platform: 'github',
        baseUrl: 'https://github.mycompany.com/team/repo',
        formatCompareUrl: (from, to) => `https://github.mycompany.com/api/compare/${from}/${to}`,
      }

      const url = createCompareUrl({
        repository,
        fromTag: 'v1.0.0',
        toTag: 'v1.1.0',
      })

      expect(url).toBe('https://github.mycompany.com/api/compare/v1.0.0/v1.1.0')
    })
  })

  describe('Unknown platform', () => {
    it('returns null', () => {
      const repository: RepositoryConfig = {
        platform: 'unknown',
        baseUrl: 'https://some-git.internal/repo',
      }

      const url = createCompareUrl({
        repository,
        fromTag: 'v1.0.0',
        toTag: 'v1.1.0',
      })

      expect(url).toBeNull()
    })
  })

  describe('Invalid inputs', () => {
    const repository: RepositoryConfig = {
      platform: 'github',
      baseUrl: 'https://github.com/owner/repo',
    }

    it('returns null for empty fromTag', () => {
      const url = createCompareUrl({
        repository,
        fromTag: '',
        toTag: 'v1.1.0',
      })

      expect(url).toBeNull()
    })

    it('returns null for empty toTag', () => {
      const url = createCompareUrl({
        repository,
        fromTag: 'v1.0.0',
        toTag: '',
      })

      expect(url).toBeNull()
    })
  })
})
