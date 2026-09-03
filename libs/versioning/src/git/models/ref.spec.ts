import type { GitRefType } from './ref'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  createGitRef,
  isBranchRef,
  isTagRef,
  isRemoteRef,
  isHeadRef,
  buildRefName,
  filterRefsByType,
  filterRefsByRemote,
  getRemote,
  compareRefsByName,
} from './ref'

describe('createGitRef', () => {
  it('parses branch ref', () => {
    const ref = createGitRef({
      fullName: 'refs/heads/main',
      commitHash: 'abc123',
    })

    expect(ref.fullName).toBe('refs/heads/main')
    expect(ref.name).toBe('main')
    expect(ref.type).toBe('branch')
    expect(ref.commitHash).toBe('abc123')
  })

  it('parses tag ref', () => {
    const ref = createGitRef({
      fullName: 'refs/tags/v1.0.0',
      commitHash: 'abc123',
    })

    expect(ref.name).toBe('v1.0.0')
    expect(ref.type).toBe('tag')
  })

  it('parses remote ref', () => {
    const ref = createGitRef({
      fullName: 'refs/remotes/origin/main',
      commitHash: 'abc123',
    })

    expect(ref.name).toBe('main')
    expect(ref.type).toBe('remote')
    expect(ref.remote).toBe('origin')
  })

  it('parses HEAD ref', () => {
    const ref = createGitRef({
      fullName: 'HEAD',
      commitHash: 'abc123',
    })

    expect(ref.name).toBe('HEAD')
    expect(ref.type).toBe('head')
  })

  it('parses stash ref', () => {
    const ref = createGitRef({
      fullName: 'refs/stash',
      commitHash: 'abc123',
    })

    expect(ref.name).toBe('stash')
    expect(ref.type).toBe('stash')
  })

  it('parses unknown ref pattern as branch (default fallback)', () => {
    const ref = createGitRef({
      fullName: 'some-unknown-ref',
      commitHash: 'abc123',
    })

    expect(ref.name).toBe('some-unknown-ref')
    expect(ref.type).toBe('branch')
  })

  it('parses nested branch name with slashes', () => {
    const ref = createGitRef({
      fullName: 'refs/heads/feature/nested/branch',
      commitHash: 'abc123',
    })

    expect(ref.name).toBe('feature/nested/branch')
    expect(ref.type).toBe('branch')
  })
})

describe('isBranchRef', () => {
  it('returns true for branch refs', () => {
    const ref = createGitRef({ fullName: 'refs/heads/main', commitHash: 'abc' })
    expect(isBranchRef(ref)).toBe(true)
  })

  it('returns false for non-branch refs', () => {
    const ref = createGitRef({ fullName: 'refs/tags/v1.0.0', commitHash: 'abc' })
    expect(isBranchRef(ref)).toBe(false)
  })
})

describe('isTagRef', () => {
  it('returns true for tag refs', () => {
    const ref = createGitRef({ fullName: 'refs/tags/v1.0.0', commitHash: 'abc' })
    expect(isTagRef(ref)).toBe(true)
  })
})

describe('isRemoteRef', () => {
  it('returns true for remote refs', () => {
    const ref = createGitRef({ fullName: 'refs/remotes/origin/main', commitHash: 'abc' })
    expect(isRemoteRef(ref)).toBe(true)
  })
})

describe('isHeadRef', () => {
  it('returns true for HEAD', () => {
    const ref = createGitRef({ fullName: 'HEAD', commitHash: 'abc' })
    expect(isHeadRef(ref)).toBe(true)
  })

  it('returns true for isHead flag', () => {
    const ref = createGitRef({ fullName: 'refs/heads/main', commitHash: 'abc', isHead: true })
    expect(isHeadRef(ref)).toBe(true)
  })
})

describe('getRemote', () => {
  it('returns remote for remote refs', () => {
    const ref = createGitRef({ fullName: 'refs/remotes/origin/main', commitHash: 'abc' })
    expect(getRemote(ref)).toBe('origin')
  })

  it('returns undefined for non-remote refs', () => {
    const ref = createGitRef({ fullName: 'refs/heads/main', commitHash: 'abc' })
    expect(getRemote(ref)).toBeUndefined()
  })

  it('returns undefined for tag refs', () => {
    const ref = createGitRef({ fullName: 'refs/tags/v1.0.0', commitHash: 'abc' })
    expect(getRemote(ref)).toBeUndefined()
  })
})

describe('buildRefName', () => {
  it('builds branch ref name', () => {
    expect(buildRefName('branch', 'main')).toBe('refs/heads/main')
  })

  it('builds tag ref name', () => {
    expect(buildRefName('tag', 'v1.0.0')).toBe('refs/tags/v1.0.0')
  })

  it('builds remote ref name', () => {
    expect(buildRefName('remote', 'main', 'origin')).toBe('refs/remotes/origin/main')
  })

  it('builds remote ref name without remote', () => {
    expect(buildRefName('remote', 'main')).toBe('refs/remotes/main')
  })

  it('builds HEAD ref name', () => {
    expect(buildRefName('head', 'anything')).toBe('HEAD')
  })

  it('builds stash ref name', () => {
    expect(buildRefName('stash', 'stash@{0}')).toBe('refs/stash')
  })

  it('returns name for unknown type (default case)', () => {
    expect(buildRefName('unknown' as unknown as GitRefType, 'some-name')).toBe('some-name')
  })
})

describe('compareRefsByName', () => {
  it('returns -1 when first ref name is less than second', () => {
    const a = createGitRef({ fullName: 'refs/heads/alpha', commitHash: 'a' })
    const b = createGitRef({ fullName: 'refs/heads/beta', commitHash: 'b' })
    expect(compareRefsByName(a, b)).toBe(-1)
  })

  it('returns 1 when first ref name is greater than second', () => {
    const a = createGitRef({ fullName: 'refs/heads/zebra', commitHash: 'a' })
    const b = createGitRef({ fullName: 'refs/heads/alpha', commitHash: 'b' })
    expect(compareRefsByName(a, b)).toBe(1)
  })

  it('returns 0 when ref names are equal', () => {
    const a = createGitRef({ fullName: 'refs/heads/main', commitHash: 'a' })
    const b = createGitRef({ fullName: 'refs/heads/main', commitHash: 'b' })
    expect(compareRefsByName(a, b)).toBe(0)
  })
})

describe('filterRefsByType', () => {
  it('filters refs by type', () => {
    const refs = [
      createGitRef({ fullName: 'refs/heads/main', commitHash: 'a' }),
      createGitRef({ fullName: 'refs/tags/v1.0.0', commitHash: 'b' }),
      createGitRef({ fullName: 'refs/heads/feature', commitHash: 'c' }),
    ]

    const branches = filterRefsByType(refs, 'branch')
    expect(branches.length).toBe(2)
    expect(branches[0]?.name).toBe('main')
    expect(branches[1]?.name).toBe('feature')
  })
})

describe('filterRefsByRemote', () => {
  it('filters refs by remote', () => {
    const refs = [
      createGitRef({ fullName: 'refs/remotes/origin/main', commitHash: 'a' }),
      createGitRef({ fullName: 'refs/remotes/upstream/main', commitHash: 'b' }),
      createGitRef({ fullName: 'refs/remotes/origin/feature', commitHash: 'c' }),
    ]

    const originRefs = filterRefsByRemote(refs, 'origin')
    expect(originRefs.length).toBe(2)
  })
})
