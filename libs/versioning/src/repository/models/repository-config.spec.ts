import { createRepositoryConfig, isRepositoryConfig } from './repository-config'

describe('createRepositoryConfig', () => {
  describe('basic creation', () => {
    it('creates a GitHub repository config', () => {
      const config = createRepositoryConfig({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
      })

      expect(config.platform).toBe('github')
      expect(config.baseUrl).toBe('https://github.com/owner/repo')
      expect(config.formatCompareUrl).toBeUndefined()
    })

    it('creates a GitLab repository config', () => {
      const config = createRepositoryConfig({
        platform: 'gitlab',
        baseUrl: 'https://gitlab.com/group/project',
      })

      expect(config.platform).toBe('gitlab')
      expect(config.baseUrl).toBe('https://gitlab.com/group/project')
    })

    it('creates a Bitbucket repository config', () => {
      const config = createRepositoryConfig({
        platform: 'bitbucket',
        baseUrl: 'https://bitbucket.org/owner/repo',
      })

      expect(config.platform).toBe('bitbucket')
      expect(config.baseUrl).toBe('https://bitbucket.org/owner/repo')
    })

    it('creates an Azure DevOps repository config', () => {
      const config = createRepositoryConfig({
        platform: 'azure-devops',
        baseUrl: 'https://dev.azure.com/org/project/_git/repo',
      })

      expect(config.platform).toBe('azure-devops')
      expect(config.baseUrl).toBe('https://dev.azure.com/org/project/_git/repo')
    })
  })

  describe('URL normalization', () => {
    it('strips trailing slashes', () => {
      const config = createRepositoryConfig({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo/',
      })

      expect(config.baseUrl).toBe('https://github.com/owner/repo')
    })

    it('strips multiple trailing slashes', () => {
      const config = createRepositoryConfig({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo///',
      })

      expect(config.baseUrl).toBe('https://github.com/owner/repo')
    })

    it('strips .git suffix', () => {
      const config = createRepositoryConfig({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo.git',
      })

      expect(config.baseUrl).toBe('https://github.com/owner/repo')
    })

    it('strips both trailing slash and .git suffix', () => {
      const config = createRepositoryConfig({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo.git/',
      })

      expect(config.baseUrl).toBe('https://github.com/owner/repo')
    })

    it('trims whitespace', () => {
      const config = createRepositoryConfig({
        platform: 'github',
        baseUrl: '  https://github.com/owner/repo  ',
      })

      expect(config.baseUrl).toBe('https://github.com/owner/repo')
    })
  })

  describe('custom platform', () => {
    it('creates custom platform with formatter', () => {
      const formatter = (from: string, to: string) => `https://custom.com/diff/${from}/${to}`

      const config = createRepositoryConfig({
        platform: 'custom',
        baseUrl: 'https://custom.com/repo',
        formatCompareUrl: formatter,
      })

      expect(config.platform).toBe('custom')
      expect(config.baseUrl).toBe('https://custom.com/repo')
      expect(config.formatCompareUrl).toBe(formatter)
    })

    it('throws error when custom platform has no formatter', () => {
      expect(() =>
        createRepositoryConfig({
          platform: 'custom',
          baseUrl: 'https://custom.com/repo',
        })
      ).toThrow("Repository config with platform 'custom' requires a formatCompareUrl function")
    })
  })

  describe('known platform with custom formatter', () => {
    it('allows custom formatter to override built-in', () => {
      const customFormatter = (from: string, to: string) => `custom/${from}/${to}`

      const config = createRepositoryConfig({
        platform: 'github',
        baseUrl: 'https://github.com/owner/repo',
        formatCompareUrl: customFormatter,
      })

      expect(config.platform).toBe('github')
      expect(config.formatCompareUrl).toBe(customFormatter)
    })
  })

  describe('unknown platform', () => {
    it('creates unknown platform config', () => {
      const config = createRepositoryConfig({
        platform: 'unknown',
        baseUrl: 'https://git.internal.com/repo',
      })

      expect(config.platform).toBe('unknown')
      expect(config.baseUrl).toBe('https://git.internal.com/repo')
    })
  })
})

describe('isRepositoryConfig', () => {
  describe('valid configs', () => {
    it('returns true for minimal config', () => {
      expect(
        isRepositoryConfig({
          platform: 'github',
          baseUrl: 'https://github.com/owner/repo',
        })
      ).toBe(true)
    })

    it('returns true for config with formatter', () => {
      expect(
        isRepositoryConfig({
          platform: 'custom',
          baseUrl: 'https://custom.com',
          formatCompareUrl: () => 'url',
        })
      ).toBe(true)
    })

    it('returns true for config created by factory', () => {
      const config = createRepositoryConfig({
        platform: 'gitlab',
        baseUrl: 'https://gitlab.com/group/project',
      })

      expect(isRepositoryConfig(config)).toBe(true)
    })
  })

  describe('invalid values', () => {
    it('returns false for null', () => {
      expect(isRepositoryConfig(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isRepositoryConfig(undefined)).toBe(false)
    })

    it('returns false for string', () => {
      expect(isRepositoryConfig('github')).toBe(false)
    })

    it('returns false for number', () => {
      expect(isRepositoryConfig(123)).toBe(false)
    })

    it('returns false for array', () => {
      expect(isRepositoryConfig(['github', 'https://github.com'])).toBe(false)
    })

    it('returns false for empty object', () => {
      expect(isRepositoryConfig({})).toBe(false)
    })

    it('returns false when platform is missing', () => {
      expect(
        isRepositoryConfig({
          baseUrl: 'https://github.com/owner/repo',
        })
      ).toBe(false)
    })

    it('returns false when baseUrl is missing', () => {
      expect(
        isRepositoryConfig({
          platform: 'github',
        })
      ).toBe(false)
    })

    it('returns false when platform is not a string', () => {
      expect(
        isRepositoryConfig({
          platform: 123,
          baseUrl: 'https://github.com/owner/repo',
        })
      ).toBe(false)
    })

    it('returns false when baseUrl is not a string', () => {
      expect(
        isRepositoryConfig({
          platform: 'github',
          baseUrl: 123,
        })
      ).toBe(false)
    })

    it('returns false when formatCompareUrl is not a function', () => {
      expect(
        isRepositoryConfig({
          platform: 'github',
          baseUrl: 'https://github.com',
          formatCompareUrl: 'not-a-function',
        })
      ).toBe(false)
    })
  })
})
