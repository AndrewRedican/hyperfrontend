import { describe, expect, it } from '@hyperfrontend/testing'
import { parseRepositoryUrl, createRepositoryConfigFromUrl } from './url'

describe('parseRepositoryUrl', () => {
  describe('GitHub URLs', () => {
    it('parses https URL', () => {
      const result = parseRepositoryUrl('https://github.com/owner/repo')
      expect(result).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
      })
    })

    it('parses https URL with .git suffix', () => {
      const result = parseRepositoryUrl('https://github.com/owner/repo.git')
      expect(result).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
      })
    })

    it('parses git+https URL', () => {
      const result = parseRepositoryUrl('git+https://github.com/owner/repo.git')
      expect(result).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
      })
    })

    it('parses git:// URL', () => {
      const result = parseRepositoryUrl('git://github.com/owner/repo.git')
      expect(result).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
      })
    })

    it('parses SSH URL', () => {
      const result = parseRepositoryUrl('git@github.com:owner/repo.git')
      expect(result).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
      })
    })

    it('parses SSH URL without .git suffix', () => {
      const result = parseRepositoryUrl('git@github.com:owner/repo')
      expect(result).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
      })
    })

    it('parses ssh:// URL', () => {
      const result = parseRepositoryUrl('ssh://git@github.com/owner/repo.git')
      expect(result).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
      })
    })

    it('handles trailing slashes', () => {
      const result = parseRepositoryUrl('https://github.com/owner/repo/')
      expect(result).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
      })
    })
  })

  describe('GitLab URLs', () => {
    it('parses https URL', () => {
      const result = parseRepositoryUrl('https://gitlab.com/group/project')
      expect(result).toEqual({
        platform: 'gitlab',
        baseUrl: 'https://gitlab.com/group/project',
      })
    })

    it('parses nested group URL', () => {
      const result = parseRepositoryUrl('https://gitlab.com/group/subgroup/project')
      expect(result).toEqual({
        platform: 'gitlab',
        baseUrl: 'https://gitlab.com/group/subgroup/project',
      })
    })

    it('parses SSH URL', () => {
      const result = parseRepositoryUrl('git@gitlab.com:group/project.git')
      expect(result).toEqual({
        platform: 'gitlab',
        baseUrl: 'https://gitlab.com/group/project',
      })
    })

    it('parses git+https URL', () => {
      const result = parseRepositoryUrl('git+https://gitlab.com/group/project.git')
      expect(result).toEqual({
        platform: 'gitlab',
        baseUrl: 'https://gitlab.com/group/project',
      })
    })
  })

  describe('Bitbucket URLs', () => {
    it('parses https URL', () => {
      const result = parseRepositoryUrl('https://bitbucket.org/owner/repo')
      expect(result).toEqual({
        platform: 'bitbucket',
        baseUrl: 'https://bitbucket.org/owner/repo',
      })
    })

    it('parses SSH URL', () => {
      const result = parseRepositoryUrl('git@bitbucket.org:owner/repo.git')
      expect(result).toEqual({
        platform: 'bitbucket',
        baseUrl: 'https://bitbucket.org/owner/repo',
      })
    })

    it('parses git+https URL', () => {
      const result = parseRepositoryUrl('git+https://bitbucket.org/team/project.git')
      expect(result).toEqual({
        platform: 'bitbucket',
        baseUrl: 'https://bitbucket.org/team/project',
      })
    })
  })

  describe('Azure DevOps URLs', () => {
    it('parses dev.azure.com URL', () => {
      const result = parseRepositoryUrl('https://dev.azure.com/org/project/_git/repo')
      expect(result).toEqual({
        platform: 'azure-devops',
        baseUrl: 'https://dev.azure.com/org/project/_git/repo',
      })
    })

    it('parses visualstudio.com URL and normalizes to dev.azure.com', () => {
      const result = parseRepositoryUrl('https://myorg.visualstudio.com/MyProject/_git/MyRepo')
      expect(result).toEqual({
        platform: 'azure-devops',
        baseUrl: 'https://dev.azure.com/myorg/MyProject/_git/MyRepo',
      })
    })

    it('parses Azure DevOps SSH URL', () => {
      const result = parseRepositoryUrl('git@ssh.dev.azure.com:v3/org/project/repo')
      expect(result).toEqual({
        platform: 'azure-devops',
        baseUrl: 'https://dev.azure.com/org/project/_git/repo',
      })
    })

    it('returns null for incomplete Azure DevOps URL', () => {
      const result = parseRepositoryUrl('https://dev.azure.com/org')
      expect(result).toBeNull()
    })

    it('returns null for Azure DevOps URL without _git segment', () => {
      const result = parseRepositoryUrl('https://dev.azure.com/org/project/repo')
      expect(result).toBeNull()
    })

    it('returns null for visualstudio.com URL without _git segment', () => {
      const result = parseRepositoryUrl('https://myorg.visualstudio.com/MyProject/browse')
      expect(result).toBeNull()
    })

    it('returns null for Azure DevOps SSH with incomplete v3 path', () => {
      const result = parseRepositoryUrl('git@ssh.dev.azure.com:v3/org')
      expect(result).toBeNull()
    })

    it('returns null for Azure DevOps URL with _git but invalid structure', () => {
      const result = parseRepositoryUrl('https://dev.azure.com/org/_git/repo')
      expect(result).toBeNull()
    })
  })

  describe('self-hosted instances', () => {
    it('detects GitHub Enterprise', () => {
      const result = parseRepositoryUrl('https://github.mycompany.com/team/project')
      expect(result).toEqual({
        platform: 'github',
        baseUrl: 'https://github.mycompany.com/team/project',
      })
    })

    it('detects GitLab self-hosted', () => {
      const result = parseRepositoryUrl('https://gitlab.internal.com/group/project')
      expect(result).toEqual({
        platform: 'gitlab',
        baseUrl: 'https://gitlab.internal.com/group/project',
      })
    })

    it('detects Bitbucket Server', () => {
      const result = parseRepositoryUrl('https://bitbucket.company.com/scm/team/repo')
      expect(result).toEqual({
        platform: 'bitbucket',
        baseUrl: 'https://bitbucket.company.com/scm/team/repo',
      })
    })

    it('detects GitHub Enterprise SSH', () => {
      const result = parseRepositoryUrl('git@github.enterprise.com:team/project.git')
      expect(result).toEqual({
        platform: 'github',
        baseUrl: 'https://github.enterprise.com/team/project',
      })
    })
  })

  describe('unknown platforms', () => {
    it('returns unknown for unrecognized platforms', () => {
      const result = parseRepositoryUrl('https://custom-git.internal/team/project')
      expect(result).toEqual({
        platform: 'unknown',
        baseUrl: 'https://custom-git.internal/team/project',
      })
    })

    it('returns unknown for generic git hosts', () => {
      const result = parseRepositoryUrl('https://git.company.com/repo/project')
      expect(result).toEqual({
        platform: 'unknown',
        baseUrl: 'https://git.company.com/repo/project',
      })
    })
  })

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseRepositoryUrl('')).toBeNull()
    })

    it('returns null for whitespace only', () => {
      expect(parseRepositoryUrl('   ')).toBeNull()
    })

    it('returns null for null/undefined', () => {
      expect(parseRepositoryUrl(null as never)).toBeNull()
      expect(parseRepositoryUrl(undefined as never)).toBeNull()
    })

    it('returns null for invalid URL', () => {
      expect(parseRepositoryUrl('not-a-url')).toBeNull()
    })

    it('returns null for URL with no path', () => {
      expect(parseRepositoryUrl('https://github.com')).toBeNull()
    })

    it('returns null for URL with empty path', () => {
      expect(parseRepositoryUrl('https://github.com/')).toBeNull()
    })

    it('trims whitespace', () => {
      const result = parseRepositoryUrl('  https://github.com/owner/repo  ')
      expect(result).toEqual({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
      })
    })

    it('handles http:// (non-secure)', () => {
      const result = parseRepositoryUrl('http://github.com/owner/repo')
      expect(result).toEqual({
        platform: 'github',
        baseUrl: 'http://github.com/owner/repo',
      })
    })

    it('returns null for file:// protocol', () => {
      expect(parseRepositoryUrl('file:///path/to/repo')).toBeNull()
    })

    it('returns null for ftp:// protocol', () => {
      expect(parseRepositoryUrl('ftp://github.com/owner/repo')).toBeNull()
    })

    it('returns null for SSH URL with empty path', () => {
      expect(parseRepositoryUrl('git@github.com:.git')).toBeNull()
    })

    it('returns null for SSH URL with only .git suffix', () => {
      expect(parseRepositoryUrl('git@github.com:/.git')).toBeNull()
    })
  })
})

describe('createRepositoryConfigFromUrl', () => {
  it('creates config for GitHub URL', () => {
    const config = createRepositoryConfigFromUrl('https://github.com/owner/repo')
    expect(config).toEqual({
      platform: 'github',
      baseUrl: 'https://github.com/owner/repo',
      formatCompareUrl: undefined,
    })
  })

  it('creates config for GitLab URL', () => {
    const config = createRepositoryConfigFromUrl('git@gitlab.com:group/project.git')
    expect(config).toEqual({
      platform: 'gitlab',
      baseUrl: 'https://gitlab.com/group/project',
      formatCompareUrl: undefined,
    })
  })

  it('creates config for Bitbucket URL', () => {
    const config = createRepositoryConfigFromUrl('https://bitbucket.org/team/repo')
    expect(config).toEqual({
      platform: 'bitbucket',
      baseUrl: 'https://bitbucket.org/team/repo',
      formatCompareUrl: undefined,
    })
  })

  it('creates config for Azure DevOps URL', () => {
    const config = createRepositoryConfigFromUrl('https://dev.azure.com/org/proj/_git/repo')
    expect(config).toEqual({
      platform: 'azure-devops',
      baseUrl: 'https://dev.azure.com/org/proj/_git/repo',
      formatCompareUrl: undefined,
    })
  })

  it('returns null for unknown platforms', () => {
    const config = createRepositoryConfigFromUrl('https://custom-git.internal/team/project')
    expect(config).toBeNull()
  })

  it('returns null for invalid URLs', () => {
    expect(createRepositoryConfigFromUrl('not-a-url')).toBeNull()
    expect(createRepositoryConfigFromUrl('')).toBeNull()
  })

  it('creates config for self-hosted instances', () => {
    const config = createRepositoryConfigFromUrl('https://github.enterprise.com/team/project')
    expect(config).toEqual({
      platform: 'github',
      baseUrl: 'https://github.enterprise.com/team/project',
      formatCompareUrl: undefined,
    })
  })
})
