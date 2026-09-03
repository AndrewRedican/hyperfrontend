import { describe, expect, it } from '@hyperfrontend/testing'
import { isKnownPlatform, detectPlatformFromHostname, PLATFORM_HOSTNAMES } from './platform'

describe('isKnownPlatform', () => {
  it('returns true for github', () => {
    expect(isKnownPlatform('github')).toBe(true)
  })

  it('returns true for gitlab', () => {
    expect(isKnownPlatform('gitlab')).toBe(true)
  })

  it('returns true for bitbucket', () => {
    expect(isKnownPlatform('bitbucket')).toBe(true)
  })

  it('returns true for azure-devops', () => {
    expect(isKnownPlatform('azure-devops')).toBe(true)
  })

  it('returns false for custom', () => {
    expect(isKnownPlatform('custom')).toBe(false)
  })

  it('returns false for unknown', () => {
    expect(isKnownPlatform('unknown')).toBe(false)
  })
})

describe('PLATFORM_HOSTNAMES', () => {
  it('maps github.com to github', () => {
    expect(PLATFORM_HOSTNAMES.get('github.com')).toBe('github')
  })

  it('maps gitlab.com to gitlab', () => {
    expect(PLATFORM_HOSTNAMES.get('gitlab.com')).toBe('gitlab')
  })

  it('maps bitbucket.org to bitbucket', () => {
    expect(PLATFORM_HOSTNAMES.get('bitbucket.org')).toBe('bitbucket')
  })

  it('maps dev.azure.com to azure-devops', () => {
    expect(PLATFORM_HOSTNAMES.get('dev.azure.com')).toBe('azure-devops')
  })

  it('maps visualstudio.com to azure-devops', () => {
    expect(PLATFORM_HOSTNAMES.get('visualstudio.com')).toBe('azure-devops')
  })

  it('returns undefined for unknown hostnames', () => {
    expect(PLATFORM_HOSTNAMES.get('unknown.com')).toBeUndefined()
  })
})

describe('detectPlatformFromHostname', () => {
  describe('exact matches', () => {
    it('detects github.com', () => {
      expect(detectPlatformFromHostname('github.com')).toBe('github')
    })

    it('detects gitlab.com', () => {
      expect(detectPlatformFromHostname('gitlab.com')).toBe('gitlab')
    })

    it('detects bitbucket.org', () => {
      expect(detectPlatformFromHostname('bitbucket.org')).toBe('bitbucket')
    })

    it('detects dev.azure.com', () => {
      expect(detectPlatformFromHostname('dev.azure.com')).toBe('azure-devops')
    })

    it('detects visualstudio.com', () => {
      expect(detectPlatformFromHostname('visualstudio.com')).toBe('azure-devops')
    })
  })

  describe('case insensitivity', () => {
    it('handles uppercase GitHub.com', () => {
      expect(detectPlatformFromHostname('GitHub.com')).toBe('github')
    })

    it('handles mixed case GitLab.COM', () => {
      expect(detectPlatformFromHostname('GitLab.COM')).toBe('gitlab')
    })
  })

  describe('Azure DevOps legacy domains', () => {
    it('detects org.visualstudio.com', () => {
      expect(detectPlatformFromHostname('myorg.visualstudio.com')).toBe('azure-devops')
    })

    it('detects company.visualstudio.com', () => {
      expect(detectPlatformFromHostname('company.visualstudio.com')).toBe('azure-devops')
    })
  })

  describe('Azure DevOps SSH domain', () => {
    it('detects ssh.dev.azure.com', () => {
      expect(detectPlatformFromHostname('ssh.dev.azure.com')).toBe('azure-devops')
    })
  })

  describe('self-hosted instances', () => {
    it('detects GitHub Enterprise (github.company.com)', () => {
      expect(detectPlatformFromHostname('github.company.com')).toBe('github')
    })

    it('detects GitHub Enterprise (git.github-internal.com)', () => {
      expect(detectPlatformFromHostname('git.github-internal.com')).toBe('github')
    })

    it('detects self-hosted GitLab (gitlab.mycompany.com)', () => {
      expect(detectPlatformFromHostname('gitlab.mycompany.com')).toBe('gitlab')
    })

    it('detects self-hosted GitLab (code.gitlab.internal)', () => {
      expect(detectPlatformFromHostname('code.gitlab.internal')).toBe('gitlab')
    })

    it('detects Bitbucket Data Center (bitbucket.internal.com)', () => {
      expect(detectPlatformFromHostname('bitbucket.internal.com')).toBe('bitbucket')
    })
  })

  describe('unknown hosts', () => {
    it('returns unknown for generic git server', () => {
      expect(detectPlatformFromHostname('git.company.com')).toBe('unknown')
    })

    it('returns unknown for custom domain', () => {
      expect(detectPlatformFromHostname('code.internal.net')).toBe('unknown')
    })

    it('returns unknown for self-hosted Gitea', () => {
      expect(detectPlatformFromHostname('gitea.company.com')).toBe('unknown')
    })
  })
})
