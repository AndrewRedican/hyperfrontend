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

    expect(tag).toEqual({ name: 'v1.0.0', commitHash: 'abc123', type: 'lightweight' })
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

    expect(tag).toEqual({
      name: 'v1.0.0',
      commitHash: 'abc123',
      type: 'annotated',
      message: 'Release v1.0.0',
      taggerName: 'John Doe',
      taggerEmail: 'john@example.com',
      tagDate: '2026-03-12T10:00:00Z',
    })
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
  it.each([
    ['v1.2.3', '1.2.3'],
    ['V1.0.0', '1.0.0'],
  ])('extracts the version from the v-prefixed tag %p', (tag, version) => {
    expect(extractVersionFromTag(tag)).toBe(version)
  })

  it.each([
    ['@scope/pkg@1.2.3', '1.2.3'],
    ['package@1.0.0', '1.0.0'],
  ])('extracts the version from the @-format tag %p', (tag, version) => {
    expect(extractVersionFromTag(tag)).toBe(version)
  })

  it.each([
    ['v1.0.0-alpha.1', '1.0.0-alpha.1'],
    ['v1.0.0-beta+build123', '1.0.0-beta+build123'],
  ])('extracts the prerelease version from the tag %p', (tag, version) => {
    expect(extractVersionFromTag(tag)).toBe(version)
  })

  it.each([
    ['release-1.2.3', '1.2.3'],
    ['pkg-v1.0.0', '1.0.0'],
  ])('extracts the version from the release-style tag %p', (tag, version) => {
    expect(extractVersionFromTag(tag)).toBe(version)
  })

  it.each(['latest', 'main'])('returns undefined for the non-version tag %p', (tag) => {
    expect(extractVersionFromTag(tag)).toBeUndefined()
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

  it.each(['pkg-1', 'pkg_2'])('returns undefined for %p, whose separator is followed by a digit but not a valid version', (tag) => {
    expect(extractVersionFromTag(tag)).toBeUndefined()
  })
})

describe('extractPackageFromTag', () => {
  it.each([
    ['@scope/pkg@1.2.3', '@scope/pkg'],
    ['@hyperfrontend/versioning@1.0.0', '@hyperfrontend/versioning'],
  ])('extracts the package from the scoped package tag %p', (tag, pkg) => {
    expect(extractPackageFromTag(tag)).toBe(pkg)
  })

  it.each([
    ['utils@1.2.3', 'utils'],
    ['lib-versioning@1.0.0', 'lib-versioning'],
  ])('extracts the package from the simple package tag %p', (tag, pkg) => {
    expect(extractPackageFromTag(tag)).toBe(pkg)
  })

  it.each([
    ['package-v1.0.0', 'package'],
    ['lib_v2.0.0', 'lib'],
  ])('extracts the package from the -v format tag %p', (tag, pkg) => {
    expect(extractPackageFromTag(tag)).toBe(pkg)
  })

  it.each([
    ['package-V1.0.0', 'package'],
    ['lib_V2.0.0', 'lib'],
  ])('extracts the package from the uppercase -V format tag %p', (tag, pkg) => {
    expect(extractPackageFromTag(tag)).toBe(pkg)
  })

  it.each(['v1.0.0', '1.0.0'])('returns undefined for the version-only tag %p', (tag) => {
    expect(extractPackageFromTag(tag)).toBeUndefined()
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
  it.each([
    ['@scope/pkg', '1.2.3', '@scope/pkg@1.2.3'],
    ['utils', '1.0.0', 'utils@1.0.0'],
  ])('builds the default-format tag for %p at version %p', (pkg, version, tagName) => {
    expect(buildTagName(pkg, version)).toBe(tagName)
  })

  it.each([
    ['v${version}', 'pkg', '1.0.0', 'v1.0.0'],
    ['${package}-v${version}', 'pkg', '2.0.0', 'pkg-v2.0.0'],
  ])('builds the tag from the custom format %p', (format, pkg, version, tagName) => {
    expect(buildTagName(pkg, version, format)).toBe(tagName)
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

    expect(sorted.map((tag) => tag.name)).toEqual(['v2.0.0', 'v1.5.0', 'v1.0.0'])
  })

  it('handles tags with no version (both have no version)', () => {
    const a = createLightweightTag({ name: 'latest', commitHash: 'a' })
    const b = createLightweightTag({ name: 'stable', commitHash: 'b' })

    expect(compareTagsByVersion(a, b)).toBe(0)
  })

  it('sorts a versioned tag before a version-less one', () => {
    const withVersion = createLightweightTag({ name: 'v1.0.0', commitHash: 'a' })
    const withoutVersion = createLightweightTag({ name: 'latest', commitHash: 'b' })

    expect(compareTagsByVersion(withVersion, withoutVersion)).toBe(-1)
  })

  it('sorts a version-less tag after a versioned one', () => {
    const withVersion = createLightweightTag({ name: 'v1.0.0', commitHash: 'a' })
    const withoutVersion = createLightweightTag({ name: 'latest', commitHash: 'b' })

    expect(compareTagsByVersion(withoutVersion, withVersion)).toBe(1)
  })

  it('sorts tags with different version lengths', () => {
    const tags = [
      createLightweightTag({ name: 'v1.0', commitHash: 'a' }),
      createLightweightTag({ name: 'v1.0.0', commitHash: 'b' }),
      createLightweightTag({ name: 'v1.0.1', commitHash: 'c' }),
    ]

    const sorted = [...tags].sort(compareTagsByVersion)

    expect(sorted.map((tag) => tag.name)).toEqual(['v1.0.1', 'v1.0', 'v1.0.0'])
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
