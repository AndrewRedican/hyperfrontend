import type { MockedFunction } from '@hyperfrontend/testing'
import { execFileSync } from 'node:child_process'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import {
  getStatus,
  isClean,
  isGitRepository,
  getRepositoryRoot,
  getHeadHash,
  getHeadShortHash,
  hasConflicts,
  getAheadCount,
  getBehindCount,
  needsPush,
  needsPull,
  getStagedFiles,
  getModifiedFiles,
  getUntrackedFiles,
  DEFAULT_STATUS_OPTIONS,
} from './status'

jest.mock('node:child_process')

const mockExecFileSync = execFileSync as MockedFunction<typeof execFileSync>

describe('getStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('branch parsing', () => {
    it('parses branch name from status output', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n')

      const status = getStatus()

      expect(status.branch).toBe('main')
      expect(status.detached).toBe(false)
    })

    it('detects detached HEAD state', () => {
      mockExecFileSync.mockReturnValue('# branch.head (detached)\n')

      const status = getStatus()

      expect(status.branch).toBe(null)
      expect(status.detached).toBe(true)
    })

    it('parses upstream branch', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n# branch.upstream origin/main\n')

      const status = getStatus()

      expect(status.branch).toBe('main')
      expect(status.upstream).toBe('origin/main')
    })

    it('parses ahead/behind counts', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n# branch.ab +5 -3\n')

      const status = getStatus()

      expect(status.ahead).toBe(5)
      expect(status.behind).toBe(3)
    })

    it('handles ahead only', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n# branch.ab +2 -0\n')

      const status = getStatus()

      expect(status.ahead).toBe(2)
      expect(status.behind).toBe(0)
    })

    it('handles behind only', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n# branch.ab +0 -7\n')

      const status = getStatus()

      expect(status.ahead).toBe(0)
      expect(status.behind).toBe(7)
    })
  })

  describe('changed entries parsing', () => {
    it('parses modified files in staging area', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n1 M. N... 100644 100644 100644 abc123 def456 src/index.ts\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(1)
      expect(status.staged[0].path).toBe('src/index.ts')
      expect(status.staged[0].indexStatus).toBe('modified')
    })

    it('parses added files in staging area', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n1 A. N... 000000 100644 100644 0000000 abc123 new-file.ts\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(1)
      expect(status.staged[0].path).toBe('new-file.ts')
      expect(status.staged[0].indexStatus).toBe('added')
    })

    it('parses deleted files in staging area', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n1 D. N... 100644 000000 000000 abc123 0000000 deleted.ts\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(1)
      expect(status.staged[0].path).toBe('deleted.ts')
      expect(status.staged[0].indexStatus).toBe('deleted')
    })

    it('parses modified files in working tree', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n1 .M N... 100644 100644 100644 abc123 abc123 changed.ts\n')

      const status = getStatus()

      expect(status.modified).toHaveLength(1)
      expect(status.modified[0].path).toBe('changed.ts')
      expect(status.modified[0].workTreeStatus).toBe('modified')
    })

    it('parses files with both index and worktree changes', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n1 MM N... 100644 100644 100644 abc123 def456 both.ts\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(1)
      expect(status.modified).toHaveLength(1)
      expect(status.staged[0].path).toBe('both.ts')
      expect(status.modified[0].path).toBe('both.ts')
    })

    it('handles type change status', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n1 T. N... 100644 120000 120000 abc123 def456 symlink.ts\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(1)
      expect(status.staged[0].indexStatus).toBe('modified')
    })

    it('ignores entries with no status', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n1 .. N... 100644 100644 100644 abc123 abc123 unchanged.ts\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(0)
      expect(status.modified).toHaveLength(0)
    })
  })

  describe('renamed entries parsing', () => {
    it('parses renamed files with tab separator', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n2 R. N... 100644 100644 100644 abc123 def456 R100 new-name.ts\told-name.ts\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(1)
      expect(status.staged[0].path).toBe('new-name.ts')
      expect(status.staged[0].origPath).toBe('old-name.ts')
      expect(status.staged[0].indexStatus).toBe('renamed')
    })

    it('parses renamed files without tab separator (no origPath)', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n2 R. N... 100644 100644 100644 abc123 def456 R100 renamed-only.ts\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(1)
      expect(status.staged[0].path).toBe('renamed-only.ts')
      expect(status.staged[0].origPath).toBeUndefined()
      expect(status.staged[0].indexStatus).toBe('renamed')
    })

    it('parses copied files', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n2 C. N... 100644 100644 100644 abc123 abc123 C100 copy.ts\toriginal.ts\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(1)
      expect(status.staged[0].indexStatus).toBe('copied')
    })

    it('parses renamed files with working tree changes', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n2 RM N... 100644 100644 100644 abc123 def456 R100 renamed.ts\told.ts\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(1)
      expect(status.modified).toHaveLength(1)
    })
  })

  describe('unmerged entries parsing', () => {
    it('parses unmerged files (conflicts)', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\nu UU N... 100644 100644 100644 100644 abc123 def456 ghi789 conflict.ts\n')

      const status = getStatus()

      expect(status.hasConflicts).toBe(true)
      expect(status.staged).toHaveLength(1)
      expect(status.staged[0].path).toBe('conflict.ts')
      expect(status.staged[0].indexStatus).toBe('unmerged')
      expect(status.staged[0].workTreeStatus).toBe('unmerged')
    })
  })

  describe('untracked files parsing', () => {
    it('parses untracked files', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n? new-file.txt\n')

      const status = getStatus()

      expect(status.untracked).toHaveLength(1)
      expect(status.untracked[0]).toBe('new-file.txt')
    })

    it('parses multiple untracked files', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n? file1.txt\n? file2.txt\n? dir/file3.ts\n')

      const status = getStatus()

      expect(status.untracked).toHaveLength(3)
      expect(status.untracked).toContain('file1.txt')
      expect(status.untracked).toContain('file2.txt')
      expect(status.untracked).toContain('dir/file3.ts')
    })
  })

  describe('clean status', () => {
    it('returns clean=true when no changes', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n')

      const status = getStatus()

      expect(status.clean).toBe(true)
    })

    it('returns clean=false when staged files exist', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n1 A. N... 000000 100644 100644 0000000 abc123 new.ts\n')

      const status = getStatus()

      expect(status.clean).toBe(false)
    })

    it('returns clean=false when modified files exist', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n1 .M N... 100644 100644 100644 abc123 abc123 modified.ts\n')

      const status = getStatus()

      expect(status.clean).toBe(false)
    })

    it('returns clean=false when untracked files exist', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n? untracked.txt\n')

      const status = getStatus()

      expect(status.clean).toBe(false)
    })

    it('returns clean=false when conflicts exist', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\nu UU N... 100644 100644 100644 100644 abc123 def456 ghi789 conflict.ts\n')

      const status = getStatus()

      expect(status.clean).toBe(false)
    })
  })

  describe('options handling', () => {
    it('uses default timeout', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n')

      getStatus()

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        ['status', '--porcelain=v2', '--branch'],
        expect.objectContaining({ timeout: DEFAULT_STATUS_OPTIONS.timeout })
      )
    })

    it('uses custom cwd', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n')

      getStatus({ cwd: '/custom/path' })

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        ['status', '--porcelain=v2', '--branch'],
        expect.objectContaining({ cwd: '/custom/path' })
      )
    })

    it('uses custom timeout', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n')

      getStatus({ timeout: 5000 })

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        ['status', '--porcelain=v2', '--branch'],
        expect.objectContaining({ timeout: 5000 })
      )
    })
  })

  describe('edge cases', () => {
    it('handles empty output', () => {
      mockExecFileSync.mockReturnValue('')

      const status = getStatus()

      expect(status.branch).toBe(null)
      expect(status.clean).toBe(true)
    })

    it('handles files with spaces in path', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n1 A. N... 000000 100644 100644 0000000 abc123 path with spaces/file name.ts\n')

      const status = getStatus()

      expect(status.staged[0].path).toBe('path with spaces/file name.ts')
    })

    it('skips malformed changed entry lines', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n1 M. short\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(0)
    })

    it('skips malformed renamed entry lines', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\n2 R. N... too short\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(0)
    })

    it('skips malformed unmerged entry lines', () => {
      mockExecFileSync.mockReturnValue('# branch.head main\nu UU short line\n')

      const status = getStatus()

      expect(status.staged).toHaveLength(0)
    })
  })
})

describe('isClean', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when working tree is clean', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n')

    expect(isClean()).toBe(true)
  })

  it('returns false when there are changes', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n1 M. N... 100644 100644 100644 abc123 def456 changed.ts\n')

    expect(isClean()).toBe(false)
  })

  it('passes options to getStatus', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n')

    isClean({ cwd: '/test/path' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/test/path' }))
  })
})

describe('isGitRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when in a git repository', () => {
    mockExecFileSync.mockReturnValue('true\n')

    expect(isGitRepository()).toBe(true)
  })

  it('returns false when not in a git repository', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Not a git repository')
    })

    expect(isGitRepository()).toBe(false)
  })

  it('passes options', () => {
    mockExecFileSync.mockReturnValue('true\n')

    isGitRepository({ cwd: '/custom/dir' })

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--is-inside-work-tree'],
      expect.objectContaining({ cwd: '/custom/dir' })
    )
  })
})

describe('getRepositoryRoot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns repository root path', () => {
    mockExecFileSync.mockReturnValue('/path/to/repo\n')

    expect(getRepositoryRoot()).toBe('/path/to/repo')
  })

  it('returns null when not in a repository', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Not a git repository')
    })

    expect(getRepositoryRoot()).toBe(null)
  })

  it('trims whitespace from output', () => {
    mockExecFileSync.mockReturnValue('  /path/to/repo  \n')

    expect(getRepositoryRoot()).toBe('/path/to/repo')
  })
})

describe('getHeadHash', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns HEAD commit hash', () => {
    mockExecFileSync.mockReturnValue('abc123def456789012345678901234567890abcd\n')

    expect(getHeadHash()).toBe('abc123def456789012345678901234567890abcd')
  })

  it('returns null on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('No HEAD')
    })

    expect(getHeadHash()).toBe(null)
  })
})

describe('getHeadShortHash', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns short HEAD hash', () => {
    mockExecFileSync.mockReturnValue('abc123d\n')

    expect(getHeadShortHash()).toBe('abc123d')
  })

  it('returns null on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('No HEAD')
    })

    expect(getHeadShortHash()).toBe(null)
  })
})

describe('hasConflicts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when conflicts exist', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\nu UU N... 100644 100644 100644 100644 abc123 def456 ghi789 conflict.ts\n')

    expect(hasConflicts()).toBe(true)
  })

  it('returns false when no conflicts', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n')

    expect(hasConflicts()).toBe(false)
  })
})

describe('getAheadCount', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns number of commits ahead', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n# branch.ab +5 -0\n')

    expect(getAheadCount()).toBe(5)
  })

  it('returns 0 when not ahead', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n')

    expect(getAheadCount()).toBe(0)
  })
})

describe('getBehindCount', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns number of commits behind', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n# branch.ab +0 -3\n')

    expect(getBehindCount()).toBe(3)
  })

  it('returns 0 when not behind', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n')

    expect(getBehindCount()).toBe(0)
  })
})

describe('needsPush', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when ahead of upstream', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n# branch.ab +2 -0\n')

    expect(needsPush()).toBe(true)
  })

  it('returns false when not ahead', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n# branch.ab +0 -0\n')

    expect(needsPush()).toBe(false)
  })
})

describe('needsPull', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when behind upstream', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n# branch.ab +0 -4\n')

    expect(needsPull()).toBe(true)
  })

  it('returns false when not behind', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n# branch.ab +0 -0\n')

    expect(needsPull()).toBe(false)
  })
})

describe('getStagedFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns paths of staged files', () => {
    mockExecFileSync.mockReturnValue(
      '# branch.head main\n1 A. N... 000000 100644 100644 0000000 abc123 file1.ts\n1 M. N... 100644 100644 100644 abc123 def456 file2.ts\n'
    )

    const files = getStagedFiles()

    expect(files).toHaveLength(2)
    expect(files).toContain('file1.ts')
    expect(files).toContain('file2.ts')
  })

  it('returns empty array when no staged files', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n')

    expect(getStagedFiles()).toHaveLength(0)
  })
})

describe('getModifiedFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns paths of modified files', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n1 .M N... 100644 100644 100644 abc123 abc123 modified.ts\n')

    const files = getModifiedFiles()

    expect(files).toHaveLength(1)
    expect(files).toContain('modified.ts')
  })

  it('returns empty array when no modified files', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n')

    expect(getModifiedFiles()).toHaveLength(0)
  })
})

describe('getUntrackedFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns paths of untracked files', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n? new1.txt\n? new2.txt\n')

    const files = getUntrackedFiles()

    expect(files).toHaveLength(2)
    expect(files).toContain('new1.txt')
    expect(files).toContain('new2.txt')
  })

  it('returns empty array when no untracked files', () => {
    mockExecFileSync.mockReturnValue('# branch.head main\n')

    expect(getUntrackedFiles()).toHaveLength(0)
  })
})

describe('DEFAULT_STATUS_OPTIONS', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_STATUS_OPTIONS.timeout).toBe(10000)
  })
})
