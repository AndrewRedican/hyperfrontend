import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Represents either a lightweight or annotated git tag.
 */
export type GitTagType = 'lightweight' | 'annotated'

/**
 * A git tag with its metadata.
 */
export interface GitTag {
  /** Tag name */
  readonly name: string

  /** Target commit hash */
  readonly commitHash: string

  /** Tag type */
  readonly type: GitTagType

  /** Tag message (for annotated tags) */
  readonly message?: string

  /** Tagger name (for annotated tags) */
  readonly taggerName?: string

  /** Tagger email (for annotated tags) */
  readonly taggerEmail?: string

  /** Tag date (ISO 8601 format, for annotated tags) */
  readonly tagDate?: string
}

/**
 * Options for creating a lightweight tag.
 */
export interface CreateLightweightTagOptions {
  /** Tag name */
  readonly name: string

  /** Target commit hash */
  readonly commitHash: string
}

/**
 * Options for creating an annotated tag.
 */
export interface CreateAnnotatedTagOptions extends CreateLightweightTagOptions {
  /** Tag message */
  readonly message: string

  /** Tagger name */
  readonly taggerName: string

  /** Tagger email */
  readonly taggerEmail: string

  /** Tag date (ISO 8601 format) */
  readonly tagDate: string
}

/**
 * Creates a lightweight git tag.
 *
 * @param options - Tag creation options
 * @returns A new GitTag object
 *
 * @example
 * const tag = createLightweightTag({
 *   name: 'v1.0.0',
 *   commitHash: 'abc123...',
 * })
 */
export function createLightweightTag(options: CreateLightweightTagOptions): GitTag {
  return {
    name: options.name,
    commitHash: options.commitHash,
    type: 'lightweight',
  }
}

/**
 * Creates an annotated git tag.
 *
 * @param options - Tag creation options
 * @returns A new GitTag object
 *
 * @example
 * const tag = createAnnotatedTag({
 *   name: 'v1.0.0',
 *   commitHash: 'abc123...',
 *   message: 'Release v1.0.0',
 *   taggerName: 'John Doe',
 *   taggerEmail: 'john@example.com',
 *   tagDate: '2026-03-12T10:00:00Z',
 * })
 */
export function createAnnotatedTag(options: CreateAnnotatedTagOptions): GitTag {
  return {
    name: options.name,
    commitHash: options.commitHash,
    type: 'annotated',
    message: options.message,
    taggerName: options.taggerName,
    taggerEmail: options.taggerEmail,
    tagDate: options.tagDate,
  }
}

/**
 * Checks if a tag is annotated.
 *
 * @param tag - Tag to check
 * @returns True if tag is annotated
 */
export function isAnnotatedTag(tag: GitTag): boolean {
  return tag.type === 'annotated'
}

/**
 * Checks if a tag is lightweight.
 *
 * @param tag - Tag to check
 * @returns True if tag is lightweight
 */
export function isLightweightTag(tag: GitTag): boolean {
  return tag.type === 'lightweight'
}

/**
 * Extracts version from tag name.
 * Handles common formats: v1.2.3, `@scope/package@1.2.3`, package@1.2.3
 * Uses character-by-character parsing (no regex).
 *
 * @param tagName - Tag name to parse
 * @returns The extracted version string or undefined if no version found
 *
 * @example
 * extractVersionFromTag('v1.2.3') // '1.2.3'
 * extractVersionFromTag('@scope/pkg@1.2.3') // '1.2.3'
 * extractVersionFromTag('release-1.2.3') // '1.2.3'
 */
export function extractVersionFromTag(tagName: string): string | undefined {
  let i = tagName.length - 1

  while (i >= 0 && tagName[i] !== '@') {
    i--
  }

  if (i >= 0) {
    const afterAt = tagName.slice(i + 1)
    const version = parseVersionPart(afterAt)
    if (version) {
      return version
    }
  }

  i = 0
  while (i < tagName.length) {
    if ((tagName[i] === 'v' || tagName[i] === 'V') && i + 1 < tagName.length) {
      const nextCode = tagName.charCodeAt(i + 1)
      if (nextCode >= 48 && nextCode <= 57) {
        const version = parseVersionPart(tagName.slice(i + 1))
        if (version) {
          return version
        }
      }
    }
    i++
  }

  i = 0
  while (i < tagName.length) {
    const char = tagName[i]
    if (char === '-' || char === '_') {
      const afterSep = tagName.slice(i + 1)
      const code = afterSep.charCodeAt(0)
      if (code >= 48 && code <= 57) {
        const version = parseVersionPart(afterSep)
        if (version) {
          return version
        }
      }
    }
    i++
  }

  return parseVersionPart(tagName)
}

/**
 * Parses a version-like string from the start of input.
 * Uses character-by-character parsing (no regex).
 *
 * @param input - String to parse
 * @returns Version string or undefined
 */
function parseVersionPart(input: string): string | undefined {
  if (!input) return undefined

  const firstCode = input.charCodeAt(0)
  if (firstCode < 48 || firstCode > 57) {
    return undefined
  }

  let i = 0
  let dotCount = 0

  while (i < input.length) {
    const code = input.charCodeAt(i)

    if (code >= 48 && code <= 57) {
      i++
    } else if (code === 46) {
      dotCount++
      i++
    } else if (code === 45) {
      i++
    } else if (code === 43) {
      i++
    } else if ((code >= 97 && code <= 122) || (code >= 65 && code <= 90)) {
      i++
    } else {
      break
    }
  }

  if (dotCount === 0) {
    return undefined
  }

  const version = input.slice(0, i)

  if (!version.includes('.')) {
    return undefined
  }

  return version
}

/**
 * Extracts package name from tag name.
 * Handles formats like: `@scope/package@1.2.3`, package@1.2.3, package-v1.2.3
 * Uses character-by-character parsing (no regex).
 *
 * @param tagName - Tag name to parse
 * @returns The extracted package name or undefined if not found
 *
 * @example
 * extractPackageFromTag('@scope/pkg@1.2.3') // '@scope/pkg'
 * extractPackageFromTag('lib-utils@1.2.3') // 'lib-utils'
 * extractPackageFromTag('v1.2.3') // undefined
 */
export function extractPackageFromTag(tagName: string): string | undefined {
  let lastVersionAt = -1
  let i = tagName.length - 1

  while (i >= 0) {
    if (tagName[i] === '@') {
      if (i + 1 < tagName.length) {
        const nextCode = tagName.charCodeAt(i + 1)
        if (nextCode >= 48 && nextCode <= 57) {
          lastVersionAt = i
          break
        }
      }
    }
    i--
  }

  if (lastVersionAt > 0) {
    return tagName.slice(0, lastVersionAt)
  }

  i = tagName.length - 1
  while (i > 0) {
    if (tagName[i] === 'v' || tagName[i] === 'V') {
      const prev = tagName[i - 1]
      if (prev === '-' || prev === '_') {
        if (i + 1 < tagName.length) {
          const nextCode = tagName.charCodeAt(i + 1)
          if (nextCode >= 48 && nextCode <= 57) {
            return tagName.slice(0, i - 1)
          }
        }
      }
    }
    i--
  }

  return undefined
}

/**
 * Builds a tag name from package name and version.
 *
 * @param packageName - Package name (e.g., '@scope/package' or 'package')
 * @param version - Version string (e.g., '1.2.3')
 * @param format - Tag format template, uses ${package} and ${version} placeholders
 * @returns Formatted tag name
 *
 * @example
 * buildTagName('@scope/pkg', '1.2.3') // '@scope/pkg@1.2.3'
 * buildTagName('utils', '1.0.0', 'v${version}') // 'v1.0.0'
 * buildTagName('pkg', '2.0.0', '${package}-v${version}') // 'pkg-v2.0.0'
 */
export function buildTagName(packageName: string, version: string, format = '${package}@${version}'): string {
  let result = ''
  let i = 0

  while (i < format.length) {
    if (i + 9 < format.length && format.slice(i, i + 10) === '${package}') {
      result += packageName
      i += 10
    } else if (i + 9 < format.length && format.slice(i, i + 10) === '${version}') {
      result += version
      i += 10
    } else {
      result += format[i]
      i++
    }
  }

  return result
}

/**
 * Compares two tags by version (newest first).
 * Useful for sorting tags.
 *
 * @param a - First tag
 * @param b - Second tag
 * @returns Comparison result (-1, 0, or 1)
 */
export function compareTagsByVersion(a: GitTag, b: GitTag): number {
  const versionA = extractVersionFromTag(a.name)
  const versionB = extractVersionFromTag(b.name)

  if (!versionA && !versionB) return 0
  if (!versionA) return 1
  if (!versionB) return -1

  return compareVersionStrings(versionB, versionA)
}

/**
 * Simple version string comparison.
 * Compares major.minor.patch numerically.
 *
 * @param a - First version
 * @param b - Second version
 * @returns Comparison result (-1, 0, or 1)
 */
function compareVersionStrings(a: string, b: string): number {
  const partsA = a.split('.')
  const partsB = b.split('.')

  const maxLen = max(partsA.length, partsB.length)

  for (let i = 0; i < maxLen; i++) {
    const numA = parseNumericPart(partsA[i])
    const numB = parseNumericPart(partsB[i])

    if (numA < numB) return -1
    if (numA > numB) return 1
  }

  return 0
}

/**
 * Parses numeric part of version segment.
 *
 * @param part - Version part to parse
 * @returns Numeric value
 */
function parseNumericPart(part: string | undefined): number {
  if (!part) return 0

  let num = 0
  for (let i = 0; i < part.length; i++) {
    const code = part.charCodeAt(i)
    if (code >= 48 && code <= 57) {
      num = num * 10 + (code - 48)
    } else {
      break
    }
  }

  return num
}
