import { describe, expect, it } from '@hyperfrontend/testing'
import { inferRepositoryFromPackageJson, inferRepositoryFromPackageJsonObject, extractRepositoryUrl } from './package-json'

describe('inferRepositoryFromPackageJson', () => {
  describe('shorthand formats', () => {
    it('parses github shorthand', () => {
      const content = JSON.stringify({ repository: 'github:owner/repo' })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
        formatCompareUrl: undefined,
      })
    })

    it('parses gitlab shorthand', () => {
      const content = JSON.stringify({ repository: 'gitlab:group/project' })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'gitlab',
        baseUrl: 'https://gitlab.com/group/project',
        formatCompareUrl: undefined,
      })
    })

    it('parses bitbucket shorthand', () => {
      const content = JSON.stringify({ repository: 'bitbucket:team/repo' })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'bitbucket',
        baseUrl: 'https://bitbucket.org/team/repo',
        formatCompareUrl: undefined,
      })
    })

    it('handles case-insensitive platform prefix', () => {
      const content = JSON.stringify({ repository: 'GitHub:Owner/Repo' })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/Owner/Repo',
        formatCompareUrl: undefined,
      })
    })

    it('returns null for unknown shorthand platform', () => {
      const content = JSON.stringify({ repository: 'unknown:owner/repo' })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toBeNull()
    })
  })

  describe('bare shorthand (defaults to GitHub)', () => {
    it('parses owner/repo format as GitHub', () => {
      const content = JSON.stringify({ repository: 'owner/repo' })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
        formatCompareUrl: undefined,
      })
    })

    it('parses complex owner/repo names', () => {
      const content = JSON.stringify({ repository: 'my-org/my-awesome-repo' })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/my-org/my-awesome-repo',
        formatCompareUrl: undefined,
      })
    })
  })

  describe('URL string format', () => {
    it('parses https URL', () => {
      const content = JSON.stringify({ repository: 'https://github.com/owner/repo' })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
        formatCompareUrl: undefined,
      })
    })

    it('parses git+https URL', () => {
      const content = JSON.stringify({ repository: 'git+https://github.com/owner/repo.git' })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
        formatCompareUrl: undefined,
      })
    })

    it('parses SSH URL', () => {
      const content = JSON.stringify({ repository: 'git@github.com:owner/repo.git' })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
        formatCompareUrl: undefined,
      })
    })
  })

  describe('object format', () => {
    it('parses object with type and url', () => {
      const content = JSON.stringify({
        repository: {
          type: 'git',
          url: 'https://github.com/owner/repo',
        },
      })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
        formatCompareUrl: undefined,
      })
    })

    it('parses object with git+https url', () => {
      const content = JSON.stringify({
        repository: {
          type: 'git',
          url: 'git+https://github.com/owner/repo.git',
        },
      })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
        formatCompareUrl: undefined,
      })
    })

    it('parses object with SSH url', () => {
      const content = JSON.stringify({
        repository: {
          type: 'git',
          url: 'git@gitlab.com:group/project.git',
        },
      })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'gitlab',
        baseUrl: 'https://gitlab.com/group/project',
        formatCompareUrl: undefined,
      })
    })

    it('ignores directory field', () => {
      const content = JSON.stringify({
        repository: {
          type: 'git',
          url: 'https://github.com/owner/monorepo',
          directory: 'packages/my-package',
        },
      })
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/monorepo',
        formatCompareUrl: undefined,
      })
    })
  })

  describe('multiple platforms', () => {
    it('handles GitLab', () => {
      const content = JSON.stringify({
        repository: {
          type: 'git',
          url: 'https://gitlab.com/group/project',
        },
      })
      const config = inferRepositoryFromPackageJson(content)
      expect(config?.platform).toBe('gitlab')
    })

    it('handles Bitbucket', () => {
      const content = JSON.stringify({
        repository: {
          type: 'git',
          url: 'https://bitbucket.org/team/repo',
        },
      })
      const config = inferRepositoryFromPackageJson(content)
      expect(config?.platform).toBe('bitbucket')
    })

    it('handles Azure DevOps', () => {
      const content = JSON.stringify({
        repository: {
          type: 'git',
          url: 'https://dev.azure.com/org/project/_git/repo',
        },
      })
      const config = inferRepositoryFromPackageJson(content)
      expect(config?.platform).toBe('azure-devops')
    })

    it('handles self-hosted GitLab', () => {
      const content = JSON.stringify({
        repository: 'https://gitlab.company.com/team/project',
      })
      const config = inferRepositoryFromPackageJson(content)
      expect(config?.platform).toBe('gitlab')
    })
  })

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(inferRepositoryFromPackageJson('')).toBeNull()
    })

    it('returns null for invalid JSON', () => {
      expect(inferRepositoryFromPackageJson('not json')).toBeNull()
    })

    it('returns null for missing repository field', () => {
      const content = JSON.stringify({ name: 'my-package' })
      expect(inferRepositoryFromPackageJson(content)).toBeNull()
    })

    it('returns null for empty repository field', () => {
      const content = JSON.stringify({ repository: '' })
      expect(inferRepositoryFromPackageJson(content)).toBeNull()
    })

    it('returns null for null repository field', () => {
      const content = JSON.stringify({ repository: null })
      expect(inferRepositoryFromPackageJson(content)).toBeNull()
    })

    it('returns null for unknown platform', () => {
      const content = JSON.stringify({
        repository: 'https://custom-git.internal/team/project',
      })
      expect(inferRepositoryFromPackageJson(content)).toBeNull()
    })

    it('returns null for object without url', () => {
      const content = JSON.stringify({
        repository: { type: 'git' },
      })
      expect(inferRepositoryFromPackageJson(content)).toBeNull()
    })

    it('handles whitespace in content', () => {
      const content = `  ${JSON.stringify({ repository: 'github:owner/repo' })}  `
      const config = inferRepositoryFromPackageJson(content)
      expect(config).toBeTruthy()
    })

    it('returns null for null content', () => {
      expect(inferRepositoryFromPackageJson(null as never)).toBeNull()
    })

    it('returns null for undefined content', () => {
      expect(inferRepositoryFromPackageJson(undefined as never)).toBeNull()
    })
  })
})

describe('inferRepositoryFromPackageJsonObject', () => {
  it('parses string repository', () => {
    const config = inferRepositoryFromPackageJsonObject({ repository: 'github:owner/repo' })
    expect(config).toEqual({
      platform: 'github',
      baseUrl: 'https://github.com/owner/repo',
      formatCompareUrl: undefined,
    })
  })

  it('parses object repository', () => {
    const config = inferRepositoryFromPackageJsonObject({
      repository: { type: 'git', url: 'https://github.com/owner/repo' },
    })
    expect(config).toEqual({
      platform: 'github',
      baseUrl: 'https://github.com/owner/repo',
      formatCompareUrl: undefined,
    })
  })

  it('returns null for missing repository', () => {
    expect(inferRepositoryFromPackageJsonObject({})).toBeNull()
  })

  it('returns null for undefined repository', () => {
    expect(inferRepositoryFromPackageJsonObject({ repository: undefined })).toBeNull()
  })
})

describe('extractRepositoryUrl', () => {
  describe('object format', () => {
    it('extracts URL from object', () => {
      const content = JSON.stringify({
        repository: { type: 'git', url: 'https://github.com/owner/repo' },
      })
      expect(extractRepositoryUrl(content)).toBe('https://github.com/owner/repo')
    })

    it('extracts and normalizes git+https URL', () => {
      const content = JSON.stringify({
        repository: { url: 'git+https://github.com/owner/repo.git' },
      })
      expect(extractRepositoryUrl(content)).toBe('https://github.com/owner/repo')
    })
  })

  describe('string format', () => {
    it('extracts https URL', () => {
      const content = JSON.stringify({ repository: 'https://github.com/owner/repo' })
      expect(extractRepositoryUrl(content)).toBe('https://github.com/owner/repo')
    })

    it('expands shorthand to URL', () => {
      const content = JSON.stringify({ repository: 'github:owner/repo' })
      expect(extractRepositoryUrl(content)).toBe('https://github.com/owner/repo')
    })

    it('expands bare shorthand to URL', () => {
      const content = JSON.stringify({ repository: 'owner/repo' })
      expect(extractRepositoryUrl(content)).toBe('https://github.com/owner/repo')
    })
  })

  describe('edge cases', () => {
    it('returns null for empty content', () => {
      expect(extractRepositoryUrl('')).toBeNull()
    })

    it('returns null for missing repository', () => {
      expect(extractRepositoryUrl(JSON.stringify({}))).toBeNull()
    })

    it('returns null for invalid JSON', () => {
      expect(extractRepositoryUrl('not json')).toBeNull()
    })

    it('returns null for unknown platform', () => {
      const content = JSON.stringify({ repository: 'https://custom.internal/team/project' })
      expect(extractRepositoryUrl(content)).toBeNull()
    })

    it('returns null for object with unknown platform URL', () => {
      const content = JSON.stringify({
        repository: { type: 'git', url: 'https://custom.internal/team/project' },
      })
      expect(extractRepositoryUrl(content)).toBeNull()
    })
  })
})
