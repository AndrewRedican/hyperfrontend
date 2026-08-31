import { describe, expect, it } from '@hyperfrontend/testing'
import {
  createLightweightTag,
  createAnnotatedTag,
  isAnnotatedTag,
  isLightweightTag,
  extractVersionFromTag,
  extractPackageFromTag,
  buildTagName,
  compareTagsByVersion,
} from './tag'

describe('createLightweightTag', () => {
  it('creates a lightweight tag', () => {
    const tag = createLightweightTag({
      name: 'v1.0.0',
      commitHash: 'abc123',
    })

    expect(tag.name).toBe('v1.0.0')
    expect(tag.commitHash).toBe('abc123')
    expect(tag.type).toBe('lightweight')
    expect(tag.message).toBeUndefined()
  })
})

describe('createAnnotatedTag', () => {
  it('creates an annotated tag', () => {
    const tag = createAnnotatedTag({
      name: 'v1.0.0',
      commitHash: 'abc123',
      message: 'Release v1.0.0',
      taggerName: 'John Doe',
      taggerEmail: 'john@example.com',
      tagDate: '2026-03-12T10:00:00Z',
    })

    expect(tag.name).toBe('v1.0.0')
    expect(tag.commitHash).toBe('abc123')
    expect(tag.type).toBe('annotated')
    expect(tag.message).toBe('Release v1.0.0')
    expect(tag.taggerName).toBe('John Doe')
  })
})

describe('isAnnotatedTag', () => {
  it('returns true for annotated tags', () => {
    const tag = createAnnotatedTag({
      name: 'v1.0.0',
      commitHash: 'abc123',
      message: 'msg',
      taggerName: 'A',
      taggerEmail: 'a@a.com',
      tagDate: '2026-01-01',
    })
    expect(isAnnotatedTag(tag)).toBe(true)
  })

  it('returns false for lightweight tags', () => {
    const tag = createLightweightTag({ name: 'v1.0.0', commitHash: 'abc123' })
    expect(isAnnotatedTag(tag)).toBe(false)
  })
})

describe('isLightweightTag', () => {
  it('returns true for lightweight tags', () => {
    const tag = createLightweightTag({ name: 'v1.0.0', commitHash: 'abc123' })
    expect(isLightweightTag(tag)).toBe(true)
  })

  it('returns false for annotated tags', () => {
    const tag = createAnnotatedTag({
      name: 'v1.0.0',
      commitHash: 'abc123',
      message: 'msg',
      taggerName: 'A',
      taggerEmail: 'a@a.com',
      tagDate: '2026-01-01',
    })
    expect(isLightweightTag(tag)).toBe(false)
  })
})

describe('extractVersionFromTag', () => {
  it('extracts version from v-prefixed tags', () => {
    expect(extractVersionFromTag('v1.2.3')).toBe('1.2.3')
    expect(extractVersionFromTag('V1.0.0')).toBe('1.0.0')
  })

  it('extracts version from @-format tags', () => {
    expect(extractVersionFromTag('@scope/pkg@1.2.3')).toBe('1.2.3')
    expect(extractVersionFromTag('package@1.0.0')).toBe('1.0.0')
  })

  it('extracts version with prerelease', () => {
    expect(extractVersionFromTag('v1.0.0-alpha.1')).toBe('1.0.0-alpha.1')
    expect(extractVersionFromTag('v1.0.0-beta+build123')).toBe('1.0.0-beta+build123')
  })

  it('extracts version from release-style tags', () => {
    expect(extractVersionFromTag('release-1.2.3')).toBe('1.2.3')
    expect(extractVersionFromTag('pkg-v1.0.0')).toBe('1.0.0')
  })

  it('returns undefined for non-version tags', () => {
    expect(extractVersionFromTag('latest')).toBeUndefined()
    expect(extractVersionFromTag('main')).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(extractVersionFromTag('')).toBeUndefined()
  })

  it('returns undefined when @ is at end with no version', () => {
    expect(extractVersionFromTag('pkg@')).toBeUndefined()
  })

  it('returns undefined when @ followed by non-digit', () => {
    expect(extractVersionFromTag('pkg@latest')).toBeUndefined()
  })

  it('extracts version from underscore separator', () => {
    expect(extractVersionFromTag('pkg_1.2.3')).toBe('1.2.3')
  })

  it('returns undefined for version without dots', () => {
    expect(extractVersionFromTag('v123')).toBeUndefined()
  })

  it('extracts version starting from string itself when valid', () => {
    expect(extractVersionFromTag('1.2.3')).toBe('1.2.3')
  })

  it('returns undefined when separator followed by digit but not valid version', () => {
    expect(extractVersionFromTag('pkg-1')).toBeUndefined()
    expect(extractVersionFromTag('pkg_2')).toBeUndefined()
  })
})

describe('extractPackageFromTag', () => {
  it('extracts package from scoped package tags', () => {
    expect(extractPackageFromTag('@scope/pkg@1.2.3')).toBe('@scope/pkg')
    expect(extractPackageFromTag('@hyperfrontend/versioning@1.0.0')).toBe('@hyperfrontend/versioning')
  })

  it('extracts package from simple package tags', () => {
    expect(extractPackageFromTag('utils@1.2.3')).toBe('utils')
    expect(extractPackageFromTag('lib-versioning@1.0.0')).toBe('lib-versioning')
  })

  it('extracts package from -v format', () => {
    expect(extractPackageFromTag('package-v1.0.0')).toBe('package')
    expect(extractPackageFromTag('lib_v2.0.0')).toBe('lib')
  })

  it('extracts package from -V format (uppercase)', () => {
    expect(extractPackageFromTag('package-V1.0.0')).toBe('package')
    expect(extractPackageFromTag('lib_V2.0.0')).toBe('lib')
  })

  it('returns undefined for version-only tags', () => {
    expect(extractPackageFromTag('v1.0.0')).toBeUndefined()
    expect(extractPackageFromTag('1.0.0')).toBeUndefined()
  })

  it('returns undefined when @ is not followed by digit', () => {
    expect(extractPackageFromTag('pkg@latest')).toBeUndefined()
  })

  it('returns undefined when -v is not followed by digit', () => {
    expect(extractPackageFromTag('package-version')).toBeUndefined()
  })

  it('returns undefined when @ is at position 0', () => {
    expect(extractPackageFromTag('@1.0.0')).toBeUndefined()
  })
})

describe('buildTagName', () => {
  it('builds tag with default format', () => {
    expect(buildTagName('@scope/pkg', '1.2.3')).toBe('@scope/pkg@1.2.3')
    expect(buildTagName('utils', '1.0.0')).toBe('utils@1.0.0')
  })

  it('builds tag with custom format', () => {
    expect(buildTagName('pkg', '1.0.0', 'v${version}')).toBe('v1.0.0')
    expect(buildTagName('pkg', '2.0.0', '${package}-v${version}')).toBe('pkg-v2.0.0')
  })

  it('builds tag with format that has no placeholders', () => {
    expect(buildTagName('pkg', '1.0.0', 'fixed-tag-name')).toBe('fixed-tag-name')
  })

  it('builds tag with multiple placeholders', () => {
    expect(buildTagName('mylib', '3.0.0', '${package}@${version}-${package}')).toBe('mylib@3.0.0-mylib')
  })

  it('builds tag with incomplete placeholder syntax', () => {
    expect(buildTagName('pkg', '1.0.0', '${pack')).toBe('${pack')
  })
})

describe('compareTagsByVersion', () => {
  it('sorts tags by version (newest first)', () => {
    const tags = [
      createLightweightTag({ name: 'v1.0.0', commitHash: 'a' }),
      createLightweightTag({ name: 'v2.0.0', commitHash: 'b' }),
      createLightweightTag({ name: 'v1.5.0', commitHash: 'c' }),
    ]

    const sorted = [...tags].sort(compareTagsByVersion)

    expect(sorted[0]?.name).toBe('v2.0.0')
    expect(sorted[1]?.name).toBe('v1.5.0')
    expect(sorted[2]?.name).toBe('v1.0.0')
  })

  it('handles tags with no version (both have no version)', () => {
    const a = createLightweightTag({ name: 'latest', commitHash: 'a' })
    const b = createLightweightTag({ name: 'stable', commitHash: 'b' })

    expect(compareTagsByVersion(a, b)).toBe(0)
  })

  it('handles one tag with version, one without (version-less comes last)', () => {
    const withVersion = createLightweightTag({ name: 'v1.0.0', commitHash: 'a' })
    const withoutVersion = createLightweightTag({ name: 'latest', commitHash: 'b' })

    expect(compareTagsByVersion(withVersion, withoutVersion)).toBe(-1)
    expect(compareTagsByVersion(withoutVersion, withVersion)).toBe(1)
  })

  it('sorts tags with different version lengths', () => {
    const tags = [
      createLightweightTag({ name: 'v1.0', commitHash: 'a' }),
      createLightweightTag({ name: 'v1.0.0', commitHash: 'b' }),
      createLightweightTag({ name: 'v1.0.1', commitHash: 'c' }),
    ]

    const sorted = [...tags].sort(compareTagsByVersion)

    expect(sorted[0]?.name).toBe('v1.0.1')
    expect(sorted[1]?.name).toBe('v1.0')
    expect(sorted[2]?.name).toBe('v1.0.0')
  })

  it('handles versions with prerelease identifiers', () => {
    const tags = [
      createLightweightTag({ name: 'v1.0.0-alpha', commitHash: 'a' }),
      createLightweightTag({ name: 'v1.0.0-beta', commitHash: 'b' }),
      createLightweightTag({ name: 'v1.0.0', commitHash: 'c' }),
    ]

    const sorted = [...tags].sort(compareTagsByVersion)

    expect(sorted).toHaveLength(3)
  })

  it('compares tags with equal versions correctly', () => {
    const a = createLightweightTag({ name: 'v1.2.3', commitHash: 'a' })
    const b = createLightweightTag({ name: 'pkg@1.2.3', commitHash: 'b' })

    expect(compareTagsByVersion(a, b)).toBe(0)
  })
})
