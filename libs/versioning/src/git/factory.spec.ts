import { execSync } from 'node:child_process'
import { createGitClient, DEFAULT_GIT_CLIENT_CONFIG } from './factory'

jest.mock('node:child_process')
jest.mock('./operations/commit', () => ({
  ...jest.requireActual('./operations/commit'),
  commit: jest.fn().mockReturnValue({ hash: 'mock-hash', shortHash: 'mock', message: 'test' }),
  amendCommit: jest.fn().mockReturnValue({ hash: 'amended-hash', shortHash: 'amend', message: 'amended' }),
  createEmptyCommit: jest.fn().mockReturnValue({ hash: 'empty-hash', shortHash: 'empt', message: 'empty' }),
}))
jest.mock('./operations/stage', () => ({
  ...jest.requireActual('./operations/stage'),
  stage: jest.fn().mockReturnValue(true),
  unstage: jest.fn().mockReturnValue(true),
  stageAll: jest.fn().mockReturnValue(true),
  hasStagedChanges: jest.fn().mockReturnValue(false),
  hasUnstagedChanges: jest.fn().mockReturnValue(false),
}))
jest.mock('./operations/head-info', () => ({
  ...jest.requireActual('./operations/head-info'),
  getHead: jest.fn().mockReturnValue('abc123'),
  getCurrentBranch: jest.fn().mockReturnValue('main'),
  hasUntrackedFiles: jest.fn().mockReturnValue(false),
}))
jest.mock('./operations/log', () => ({
  ...jest.requireActual('./operations/log'),
  getCommitLog: jest.fn().mockReturnValue([]),
  getCommitsBetween: jest.fn().mockReturnValue([]),
  getCommitsSince: jest.fn().mockReturnValue([]),
  getCommit: jest.fn().mockReturnValue(null),
  commitExists: jest.fn().mockReturnValue(false),
  commitReachableFromHead: jest.fn().mockReturnValue(false),
}))
jest.mock('./operations/status', () => ({
  getStatus: jest.fn().mockReturnValue({
    branch: 'main',
    detached: false,
    ahead: 0,
    behind: 0,
    staged: [],
    modified: [],
    untracked: [],
    clean: true,
    hasConflicts: false,
  }),
  isClean: jest.fn().mockReturnValue(true),
  isGitRepository: jest.fn().mockReturnValue(true),
  getRepositoryRoot: jest.fn().mockReturnValue('/repo'),
  getHeadHash: jest.fn().mockReturnValue('abc123'),
  getHeadShortHash: jest.fn().mockReturnValue('abc'),
  hasConflicts: jest.fn().mockReturnValue(false),
  getAheadCount: jest.fn().mockReturnValue(0),
  getBehindCount: jest.fn().mockReturnValue(0),
  needsPush: jest.fn().mockReturnValue(false),
  needsPull: jest.fn().mockReturnValue(false),
  getStagedFiles: jest.fn().mockReturnValue([]),
  getModifiedFiles: jest.fn().mockReturnValue([]),
  getUntrackedFiles: jest.fn().mockReturnValue([]),
}))
jest.mock('./operations/query-tags', () => ({
  ...jest.requireActual('./operations/query-tags'),
  getTags: jest.fn().mockReturnValue([]),
  getTag: jest.fn().mockReturnValue(null),
  tagExists: jest.fn().mockReturnValue(false),
  getLatestTag: jest.fn().mockReturnValue(null),
  getTagsForPackage: jest.fn().mockReturnValue([]),
}))
jest.mock('./operations/manage-tags', () => ({
  ...jest.requireActual('./operations/manage-tags'),
  createTag: jest.fn().mockReturnValue({ name: 'v1.0.0', version: { major: 1, minor: 0, patch: 0 } }),
  deleteTag: jest.fn().mockReturnValue(true),
  pushTag: jest.fn().mockReturnValue(true),
}))

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>

describe('createGitClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('configuration', () => {
    it('uses current working directory by default', () => {
      const client = createGitClient()

      expect(client.cwd).toBe(process.cwd())
    })

    it('uses custom working directory', () => {
      const client = createGitClient({ cwd: '/custom/path' })

      expect(client.cwd).toBe('/custom/path')
    })

    it('uses default timeout', () => {
      const client = createGitClient()

      expect(client.timeout).toBe(DEFAULT_GIT_CLIENT_CONFIG.timeout)
    })

    it('uses custom timeout', () => {
      const client = createGitClient({ timeout: 5000 })

      expect(client.timeout).toBe(5000)
    })
  })

  describe('log operations', () => {
    it('provides getCommitLog method', () => {
      const client = createGitClient()

      const result = client.getCommitLog()

      expect(result).toEqual([])
    })

    it('provides getCommitsBetween method', () => {
      const client = createGitClient()

      const result = client.getCommitsBetween('v1.0.0', 'HEAD')

      expect(result).toEqual([])
    })

    it('provides getCommitsSince method', () => {
      const client = createGitClient()

      const result = client.getCommitsSince('v1.0.0')

      expect(result).toEqual([])
    })

    it('provides getCommit method', () => {
      const client = createGitClient()

      const result = client.getCommit('abc123')

      expect(result).toBe(null)
    })

    it('provides commitExists method', () => {
      const client = createGitClient()

      const result = client.commitExists('abc123')

      expect(result).toBe(false)
    })

    it('provides commitReachableFromHead method', () => {
      const client = createGitClient()

      const result = client.commitReachableFromHead('abc123')

      expect(result).toBe(false)
    })
  })

  describe('tag operations', () => {
    it('provides getTags method', () => {
      const client = createGitClient()

      const result = client.getTags()

      expect(result).toEqual([])
    })

    it('provides getTag method', () => {
      const client = createGitClient()

      const result = client.getTag('v1.0.0')

      expect(result).toBe(null)
    })

    it('provides createTag method', () => {
      const client = createGitClient()

      const result = client.createTag('v1.0.0')

      expect(result.name).toBe('v1.0.0')
    })

    it('provides deleteTag method', () => {
      const client = createGitClient()

      const result = client.deleteTag('v1.0.0')

      expect(result).toBe(true)
    })

    it('provides tagExists method', () => {
      const client = createGitClient()

      const result = client.tagExists('v1.0.0')

      expect(result).toBe(false)
    })

    it('provides getLatestTag method', () => {
      const client = createGitClient()

      const result = client.getLatestTag()

      expect(result).toBe(null)
    })

    it('provides getTagsForPackage method', () => {
      const client = createGitClient()

      const result = client.getTagsForPackage('@scope/package')

      expect(result).toEqual([])
    })

    it('provides pushTag method', () => {
      const client = createGitClient()

      const result = client.pushTag('v1.0.0')

      expect(result).toBe(true)
    })
  })

  describe('commit operations', () => {
    it('provides createCommit method', () => {
      const client = createGitClient()

      const result = client.createCommit('test message')

      expect(result.hash).toBe('mock-hash')
    })

    it('provides stage method', () => {
      const client = createGitClient()

      const result = client.stage(['file.ts'])

      expect(result).toBe(true)
    })

    it('provides unstage method', () => {
      const client = createGitClient()

      const result = client.unstage(['file.ts'])

      expect(result).toBe(true)
    })

    it('provides stageAll method', () => {
      const client = createGitClient()

      const result = client.stageAll()

      expect(result).toBe(true)
    })

    it('provides amendCommit method', () => {
      const client = createGitClient()

      const result = client.amendCommit('amended message')

      expect(result.hash).toBe('amended-hash')
    })

    it('provides createEmptyCommit method', () => {
      const client = createGitClient()

      const result = client.createEmptyCommit('empty commit')

      expect(result.hash).toBe('empty-hash')
    })

    it('provides getHead method', () => {
      const client = createGitClient()

      const result = client.getHead()

      expect(result).toBe('abc123')
    })

    it('provides getCurrentBranch method', () => {
      const client = createGitClient()

      const result = client.getCurrentBranch()

      expect(result).toBe('main')
    })

    it('provides hasStagedChanges method', () => {
      const client = createGitClient()

      const result = client.hasStagedChanges()

      expect(result).toBe(false)
    })

    it('provides hasUnstagedChanges method', () => {
      const client = createGitClient()

      const result = client.hasUnstagedChanges()

      expect(result).toBe(false)
    })

    it('provides hasUntrackedFiles method', () => {
      const client = createGitClient()

      const result = client.hasUntrackedFiles()

      expect(result).toBe(false)
    })
  })

  describe('status operations', () => {
    it('provides getStatus method', () => {
      const client = createGitClient()

      const result = client.getStatus()

      expect(result.branch).toBe('main')
    })

    it('provides isClean method', () => {
      const client = createGitClient()

      const result = client.isClean()

      expect(result).toBe(true)
    })

    it('provides isGitRepository method', () => {
      const client = createGitClient()

      const result = client.isGitRepository()

      expect(result).toBe(true)
    })

    it('provides getRepositoryRoot method', () => {
      const client = createGitClient()

      const result = client.getRepositoryRoot()

      expect(result).toBe('/repo')
    })

    it('provides getHeadHash method', () => {
      const client = createGitClient()

      const result = client.getHeadHash()

      expect(result).toBe('abc123')
    })

    it('provides getHeadShortHash method', () => {
      const client = createGitClient()

      const result = client.getHeadShortHash()

      expect(result).toBe('abc')
    })

    it('provides hasConflicts method', () => {
      const client = createGitClient()

      const result = client.hasConflicts()

      expect(result).toBe(false)
    })

    it('provides getAheadCount method', () => {
      const client = createGitClient()

      const result = client.getAheadCount()

      expect(result).toBe(0)
    })

    it('provides getBehindCount method', () => {
      const client = createGitClient()

      const result = client.getBehindCount()

      expect(result).toBe(0)
    })

    it('provides needsPush method', () => {
      const client = createGitClient()

      const result = client.needsPush()

      expect(result).toBe(false)
    })

    it('provides needsPull method', () => {
      const client = createGitClient()

      const result = client.needsPull()

      expect(result).toBe(false)
    })

    it('provides getStagedFiles method', () => {
      const client = createGitClient()

      const result = client.getStagedFiles()

      expect(result).toEqual([])
    })

    it('provides getModifiedFiles method', () => {
      const client = createGitClient()

      const result = client.getModifiedFiles()

      expect(result).toEqual([])
    })

    it('provides getUntrackedFiles method', () => {
      const client = createGitClient()

      const result = client.getUntrackedFiles()

      expect(result).toEqual([])
    })
  })

  describe('ref operations', () => {
    it('provides getRefs method', () => {
      mockExecSync.mockReturnValue('abc123 refs/heads/main\ndef456 refs/tags/v1.0.0\n')

      const client = createGitClient()
      const result = client.getRefs()

      expect(result).toHaveLength(2)
    })

    it('returns empty array when git show-ref fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a repository')
      })

      const client = createGitClient()
      const result = client.getRefs()

      expect(result).toEqual([])
    })

    it('provides getBranches method', () => {
      mockExecSync.mockReturnValue('abc123 refs/heads/main\ndef456 refs/heads/feature\n')

      const client = createGitClient()
      const result = client.getBranches()

      expect(result.length).toBeGreaterThanOrEqual(0)
    })

    it('provides getRemoteBranches method', () => {
      mockExecSync.mockReturnValue('abc123 refs/remotes/origin/main\n')

      const client = createGitClient()
      const result = client.getRemoteBranches()

      expect(result).toBeDefined()
    })

    it('filters remote branches by remote name', () => {
      mockExecSync.mockReturnValue('abc123 refs/remotes/origin/main\ndef456 refs/remotes/upstream/main\n')

      const client = createGitClient()
      const result = client.getRemoteBranches('origin')

      expect(result).toBeDefined()
    })
  })

  describe('fetch operation', () => {
    it('provides fetch method that returns true on success', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      const result = client.fetch()

      expect(result).toBe(true)
      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git fetch origin'), expect.any(Object))
    })

    it('passes custom remote to fetch', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      client.fetch('upstream')

      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git fetch upstream'), expect.any(Object))
    })

    it('adds prune flag when requested', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      client.fetch('origin', { prune: true })

      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--prune'), expect.any(Object))
    })

    it('adds tags flag when requested', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      client.fetch('origin', { tags: true })

      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--tags'), expect.any(Object))
    })

    it('returns false on fetch failure', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Network error')
      })

      const client = createGitClient()
      const result = client.fetch()

      expect(result).toBe(false)
    })
  })

  describe('pull operation', () => {
    it('provides pull method that returns true on success', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      const result = client.pull()

      expect(result).toBe(true)
      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git pull origin'), expect.any(Object))
    })

    it('passes custom remote to pull', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      client.pull('upstream')

      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git pull upstream'), expect.any(Object))
    })

    it('passes branch name to pull', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      client.pull('origin', 'develop')

      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git pull origin develop'), expect.any(Object))
    })

    it('returns false on pull failure', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Merge conflict')
      })

      const client = createGitClient()
      const result = client.pull()

      expect(result).toBe(false)
    })
  })

  describe('push operation', () => {
    it('provides push method that returns true on success', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      const result = client.push()

      expect(result).toBe(true)
      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git push origin'), expect.any(Object))
    })

    it('passes custom remote to push', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      client.push('upstream')

      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git push upstream'), expect.any(Object))
    })

    it('passes branch name to push', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      client.push('origin', 'feature-branch')

      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git push origin feature-branch'), expect.any(Object))
    })

    it('adds force flag when requested', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      client.push('origin', 'main', { force: true })

      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--force'), expect.any(Object))
    })

    it('adds set-upstream flag when requested', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      client.push('origin', 'new-branch', { setUpstream: true })

      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--set-upstream'), expect.any(Object))
    })

    it('returns false on push failure', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Remote rejected')
      })

      const client = createGitClient()
      const result = client.push()

      expect(result).toBe(false)
    })
  })

  describe('getRemoteUrl operation', () => {
    it('returns remote URL on success', () => {
      mockExecSync.mockReturnValue('https://github.com/owner/repo.git\n')

      const client = createGitClient()
      const result = client.getRemoteUrl()

      expect(result).toBe('https://github.com/owner/repo.git')
      expect(mockExecSync).toHaveBeenCalledWith('git remote get-url origin', expect.any(Object))
    })

    it('uses custom remote name', () => {
      mockExecSync.mockReturnValue('https://github.com/other/repo.git\n')

      const client = createGitClient()
      const result = client.getRemoteUrl('upstream')

      expect(result).toBe('https://github.com/other/repo.git')
      expect(mockExecSync).toHaveBeenCalledWith('git remote get-url upstream', expect.any(Object))
    })

    it('returns null when remote does not exist', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("fatal: No such remote 'nonexistent'")
      })

      const client = createGitClient()
      const result = client.getRemoteUrl('nonexistent')

      expect(result).toBeNull()
    })

    it('returns null for empty output', () => {
      mockExecSync.mockReturnValue('')

      const client = createGitClient()
      const result = client.getRemoteUrl()

      expect(result).toBeNull()
    })

    it('trims whitespace from URL', () => {
      mockExecSync.mockReturnValue('  git@github.com:owner/repo.git  \n')

      const client = createGitClient()
      const result = client.getRemoteUrl()

      expect(result).toBe('git@github.com:owner/repo.git')
    })
  })
})

describe('DEFAULT_GIT_CLIENT_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_GIT_CLIENT_CONFIG.timeout).toBe(30000)
    expect(DEFAULT_GIT_CLIENT_CONFIG.throwOnError).toBe(true)
    expect(DEFAULT_GIT_CLIENT_CONFIG.cwd).toBe(process.cwd())
  })
})
