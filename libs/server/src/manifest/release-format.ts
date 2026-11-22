import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { isSafeInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** File name of a release manifest, at the root of the artifact it describes. */
export const RELEASE_MANIFEST_FILENAME = 'hf-release.json'

/** One file of a release. */
export interface ReleaseFile {
  /** Path relative to the manifest's directory, "/" separated. */
  readonly path: string
  /** Length in bytes. */
  readonly size: number
  /** SHA-256 of the bytes: 64 lowercase hexadecimal characters. */
  readonly sha256: string
}

/** Schema 1 of `hf-release.json`: an index of the bytes of one artifact. */
export interface ReleaseManifest {
  /** The number of the schema the manifest is written in. */
  readonly schema: 1
  /** The artifact's own name; for a shell, its package name. */
  readonly name: string
  /** The artifact's version, canonical semver 2.0.0, no leading "v". */
  readonly version: string
  /** Every regular file under the manifest's directory except the manifest. */
  readonly files: readonly ReleaseFile[]
}

/** What kind of problem a {@link ReleaseManifestIssue} reports, stable across releases so a tool can branch on it. */
export type ReleaseManifestIssueCode =
  | 'manifest-not-json'
  | 'manifest-not-object'
  | 'schema-missing'
  | 'schema-unsupported'
  | 'member-unknown'
  | 'name-invalid'
  | 'version-invalid'
  | 'files-not-array'
  | 'files-empty'
  | 'file-not-object'
  | 'file-path-invalid'
  | 'file-path-reserved'
  | 'file-path-order'
  | 'file-size-invalid'
  | 'file-sha256-invalid'
  | 'manifest-not-canonical'

/** One problem found in a release manifest, located and worded without repeating any value or key of the file. */
export interface ReleaseManifestIssue {
  /** The kind of problem. */
  readonly code: ReleaseManifestIssueCode
  /** Where the problem sits, such as `files[2].path`; empty when the manifest as a whole is at fault. */
  readonly path: string
  /** The whole sentence a tool prints, which names the place itself. */
  readonly message: string
}

const MANIFEST_MEMBERS: readonly string[] = ['schema', 'name', 'version', 'files']
const FILE_MEMBERS: readonly string[] = ['path', 'size', 'sha256']

// note: Under the unicode flag a surrogate range matches only a surrogate that has no partner, which is what makes a string ill-formed.
// why: U+FFFD is what a lossy decode leaves of a malformed byte, so a name on disk that is not UTF-8 can never read as a listed one.
const NAME_FORBIDDEN = /[\s\p{Cc}\uD800-\uDFFF\uFFFD]/u
const PATH_FORBIDDEN = /[\\\p{Cc}\uD800-\uDFFF\uFFFD]/u
const SHA256_PATTERN = /^[0-9a-f]{64}$/

// note: A number of a version core: digits with no leading zero.
const VERSION_NUMBER = /^(?:0|[1-9]\d*)$/
const VERSION_IDENTIFIER = /^[0-9A-Za-z-]+$/

// note: A prerelease identifier made of digits alone is a number, and a number carries no leading zero.
const LEADING_ZERO = /^0\d+$/

const NOT_CANONICAL: ReleaseManifestIssue = {
  code: 'manifest-not-canonical',
  path: '',
  message: 'the file is not in canonical form: its bytes differ from the serialisation of its own content.',
}

/**
 * Narrows an unknown value to a plain record.
 *
 * @param value - The value to test.
 * @returns `true` when the value is a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isArray(value)
}

/**
 * Builds an issue whose message opens with the place it was found.
 *
 * @param code - The kind of problem.
 * @param path - Where the problem sits; empty for the manifest as a whole.
 * @param text - What is wrong there, as the rest of the sentence.
 * @returns The issue, its message naming the place and never a value found there.
 */
function issueAt(code: ReleaseManifestIssueCode, path: string, text: string): ReleaseManifestIssue {
  return { code, path, message: `${path === '' ? 'the manifest' : path} ${text}` }
}

/**
 * Finds whether a record holds a member its schema does not define.
 *
 * @param holder - The manifest or one file entry.
 * @param members - The names the schema defines for it.
 * @param path - Where the holder sits.
 * @returns One problem for the holder however many such members it has, since a key of an untrusted file is never repeated.
 */
function checkMembers(holder: Record<string, unknown>, members: readonly string[], path: string): readonly ReleaseManifestIssue[] {
  return keys(holder).every((key) => members.includes(key))
    ? []
    : [issueAt('member-unknown', path, 'holds a member schema 1 does not define.')]
}

/**
 * Tells whether a value is a path a manifest may list.
 *
 * @param value - The candidate path.
 * @returns `true` for well-formed text with no backslash, control character or U+FFFD whose "/" separated segments are all named and none is "." or "..".
 *
 * @example A path a manifest may list and two it may not
 * ```typescript
 * isReleasePath('assets/app.css') // => true
 * isReleasePath('../app.css') // => false
 * isReleasePath('app\n.css') // => false
 * ```
 */
export function isReleasePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !PATH_FORBIDDEN.test(value) &&
    value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  )
}

/**
 * Splits a text at the first occurrence of a mark.
 *
 * @param text - The text to split.
 * @param mark - The single character to split at.
 * @returns What stands ahead of the mark, then what follows it; the whole text and `undefined` when the mark is absent.
 */
function splitOnce(text: string, mark: string): readonly [string, string | undefined] {
  const at = text.indexOf(mark)
  return at === -1 ? [text, undefined] : [text.slice(0, at), text.slice(at + 1)]
}

/**
 * Tells whether a value is a version in the grammar of semantic versioning 2.0.0.
 *
 * @param value - The candidate version.
 * @returns `true` for three numbers without leading zeros, optionally followed by dot-separated prerelease identifiers after a hyphen and build identifiers after a plus.
 */
function isVersion(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }
  const [precedence, build] = splitOnce(value, '+')
  const [core, prerelease] = splitOnce(precedence, '-')
  const numbers = core.split('.')
  return (
    numbers.length === 3 &&
    numbers.every((part) => VERSION_NUMBER.test(part)) &&
    (prerelease === undefined || prerelease.split('.').every((part) => VERSION_IDENTIFIER.test(part) && !LEADING_ZERO.test(part))) &&
    (build === undefined || build.split('.').every((part) => VERSION_IDENTIFIER.test(part)))
  )
}

/**
 * Compares two texts code point by code point, which is the order of their UTF-8 bytes and the order a manifest lists its paths in. The comparison JavaScript makes by default goes by UTF-16 code unit, which places a character beyond U+FFFF ahead of the ones from U+E000 to U+FFFF.
 *
 * @param left - The first text, well-formed Unicode.
 * @param right - The second text, well-formed Unicode.
 * @returns A negative number when the first sorts ahead, a positive one when it sorts after, and zero when the two are equal.
 *
 * @example Sorting paths into manifest order
 * ```typescript
 * ['index.mjs', 'README.md', 'index.cjs'].sort(compareCodePoints)
 * // => ['README.md', 'index.cjs', 'index.mjs']
 * ```
 */
export function compareCodePoints(left: string, right: string): number {
  let index = 0
  while (index < left.length && left[index] === right[index]) {
    index += 1
  }
  // why: Read at the first differing code unit, a code point is the whole character when the unit opens a pair and the unit alone when the pair's first half was equal.
  return (left.codePointAt(index) ?? -1) - (right.codePointAt(index) ?? -1)
}

/**
 * Finds what is wrong with the path of one file entry.
 *
 * @param path - The value of the entry's path member.
 * @param at - Where the member sits.
 * @param previous - The well-formed path listed just before, when there is one.
 * @returns At most one problem: a malformed path, the reserved one, or one that does not sort after its predecessor.
 */
function checkPath(path: unknown, at: string, previous: string | undefined): readonly ReleaseManifestIssue[] {
  if (!isReleasePath(path)) {
    return [
      issueAt(
        'file-path-invalid',
        at,
        'must be a relative path with "/" separators and no empty, "." or ".." segment, backslash, control character or U+FFFD.'
      ),
    ]
  }
  if (path === RELEASE_MANIFEST_FILENAME) {
    return [issueAt('file-path-reserved', at, 'names the manifest itself, which a manifest never lists.')]
  }
  return previous !== undefined && compareCodePoints(previous, path) >= 0
    ? [issueAt('file-path-order', at, 'must sort after the path before it: paths ascend by Unicode code point and none repeats.')]
    : []
}

/**
 * Finds what is wrong with one entry of the file list.
 *
 * @param entry - The candidate entry.
 * @param index - The entry's place in the list.
 * @param previous - The well-formed path listed just before, when there is one.
 * @param issues - The problems of the whole list, which the entry's are added to.
 * @returns The path the next entry is compared with: none after a malformed one, so one bad path is reported once.
 */
function checkFile(entry: unknown, index: number, previous: string | undefined, issues: ReleaseManifestIssue[]): string | undefined {
  const at = `files[${index}]`
  if (!isRecord(entry)) {
    issues.push(issueAt('file-not-object', at, 'must be an object.'))
    return undefined
  }
  const path = entry['path']
  const size = entry['size']
  const sha256 = entry['sha256']
  issues.push(
    ...checkMembers(entry, FILE_MEMBERS, at),
    ...checkPath(path, `${at}.path`, previous),
    ...(typeof size === 'number' && isSafeInteger(size) && size >= 0
      ? []
      : [issueAt('file-size-invalid', `${at}.size`, 'must be a whole number of bytes from 0 to 9007199254740991.')]),
    ...(typeof sha256 === 'string' && SHA256_PATTERN.test(sha256)
      ? []
      : [issueAt('file-sha256-invalid', `${at}.sha256`, 'must be 64 lowercase hexadecimal characters.')])
  )
  return isReleasePath(path) ? path : undefined
}

/**
 * Finds what is wrong with the file list of a manifest.
 *
 * @param files - The value of the manifest's files member.
 * @returns The problems of the list itself, or of each entry in list order.
 */
function checkFiles(files: unknown): readonly ReleaseManifestIssue[] {
  if (!isArray(files)) {
    return [issueAt('files-not-array', 'files', 'must be an array.')]
  }
  if (files.length === 0) {
    return [issueAt('files-empty', 'files', 'must list at least one file.')]
  }
  // why: One array takes the problems of every entry, since copying what was collected for each entry costs time quadratic in a file anyone may write.
  const issues: ReleaseManifestIssue[] = []
  files.reduce<string | undefined>((previous, entry: unknown, index) => checkFile(entry, index, previous, issues), undefined)
  return issues
}

/**
 * Collects every problem of an unknown value as a {@link ReleaseManifest}, where {@link validateReleaseManifest} throws them. A value that is no object, a missing schema and a schema other than 1 are each reported alone, because nothing else can be judged under unknown rules. Otherwise every problem is reported, in the order the schema lists the members. No message repeats a value or a key of the document.
 *
 * @param value - The parsed content of a manifest file.
 * @returns The problems, each with a stable code, a path and a full sentence; empty when the manifest is sound.
 *
 * @example Listing what a tool should report about a manifest
 * ```typescript
 * checkReleaseManifest({ schema: 1, name: 'clock-shell', version: 'v1.0.0', files: [] }).map((issue) => issue.message)
 * // => ['version must be a semantic version such as 1.2.3, with no leading "v".', 'files must list at least one file.']
 * ```
 */
export function checkReleaseManifest(value: unknown): readonly ReleaseManifestIssue[] {
  if (!isRecord(value)) {
    return [issueAt('manifest-not-object', '', 'must be an object.')]
  }
  const schema = value['schema']
  const name = value['name']
  if (schema === undefined) {
    return [issueAt('schema-missing', 'schema', 'is required.')]
  }
  if (schema !== 1) {
    return [issueAt('schema-unsupported', 'schema', 'is not one this reader supports; it supports 1.')]
  }
  return [
    ...checkMembers(value, MANIFEST_MEMBERS, ''),
    ...(typeof name === 'string' && name.length > 0 && !NAME_FORBIDDEN.test(name)
      ? []
      : [issueAt('name-invalid', 'name', 'must be a non-empty string with no whitespace, control character or U+FFFD.')]),
    ...(isVersion(value['version'])
      ? []
      : [issueAt('version-invalid', 'version', 'must be a semantic version such as 1.2.3, with no leading "v".')]),
    ...checkFiles(value['files']),
  ]
}

/**
 * Builds the error a refused manifest is thrown as.
 *
 * @param issues - The problems found.
 * @param sourcePath - The file the manifest came from.
 * @returns One error naming the file, with each problem on a line of its own.
 */
function refusal(issues: readonly ReleaseManifestIssue[], sourcePath: string): Error {
  return createError([`${sourcePath}: invalid release manifest:`, ...issues.map((issue) => `  - ${issue.message}`)].join('\n'))
}

/**
 * Validates an unknown value as a {@link ReleaseManifest}.
 *
 * @param value - The parsed content of a manifest file.
 * @param sourcePath - The file the content came from, used to open the error message.
 * @returns The same value, typed as a manifest.
 * @throws {Error} When the manifest has a problem: the source path, then one line per problem.
 *
 * @example Validating a manifest built in memory
 * ```typescript
 * const files = [{ path: 'package.json', size: 505, sha256: 'c21e68ff1da3dac9ce83d330899a9513b1c8f52670bd880af3c00d23877a5889' }]
 * validateReleaseManifest({ schema: 1, name: 'clock-shell', version: '0.3.0', files }, 'shell/hf-release.json')
 * ```
 */
export function validateReleaseManifest(value: unknown, sourcePath: string): ReleaseManifest {
  const issues = checkReleaseManifest(value)
  if (issues.length > 0) {
    throw refusal(issues, sourcePath)
  }
  return value as ReleaseManifest
}

/**
 * Writes a manifest in its one canonical form: two-space JSON with the members in schema order, closed by one line feed. The UTF-8 encoding of the result is what `hf-release.json` holds. A member the schema does not define is left out.
 *
 * @param manifest - The manifest to write.
 * @returns The text of the manifest file.
 *
 * @example Writing the text of a manifest file
 * ```typescript
 * const files = [{ path: 'package.json', size: 505, sha256: 'c21e68ff1da3dac9ce83d330899a9513b1c8f52670bd880af3c00d23877a5889' }]
 * serializeReleaseManifest({ schema: 1, name: 'clock-shell', version: '0.3.0', files })
 * // => '{\n  "schema": 1,\n  "name": "clock-shell",\n ... }\n'
 * ```
 */
export function serializeReleaseManifest(manifest: ReleaseManifest): string {
  const files = manifest.files.map((file) => ({ path: file.path, size: file.size, sha256: file.sha256 }))
  return `${stringify({ schema: manifest.schema, name: manifest.name, version: manifest.version, files }, null, 2)}\n`
}

/**
 * Reads the text of a manifest file as JSON.
 *
 * @param text - The decoded content of the file.
 * @param sourcePath - The file the text came from.
 * @returns The value the text spells.
 * @throws {Error} When the text is not JSON.
 */
function readJson(text: string, sourcePath: string): unknown {
  try {
    return parse(text)
  } catch {
    throw refusal([{ code: 'manifest-not-json', path: '', message: 'the file is not JSON.' }], sourcePath)
  }
}

/**
 * Parses the text of an `hf-release.json` file into a validated {@link ReleaseManifest}. A file is valid only in canonical form, so one content has one byte sequence: text that parses to a sound manifest but differs from {@link serializeReleaseManifest} of that manifest is refused. That covers other spacing, another member order, a repeated key and another spelling of a number.
 *
 * @param text - The content of the file, decoded as UTF-8 by a decoder that refuses a malformed sequence and keeps a byte order mark, so that no two byte sequences give one text.
 * @param sourcePath - The file the text came from, used to open the error message.
 * @returns The validated content of the file.
 * @throws {Error} When the text is not JSON, the content has a problem, or the content is sound and the text is not canonical.
 *
 * @example Reading a manifest from disk
 * ```typescript
 * import { readFileSync } from 'node:fs'
 *
 * const strict = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
 * const manifest = parseReleaseManifest(strict.decode(readFileSync('shell/hf-release.json')), 'shell/hf-release.json')
 * ```
 */
export function parseReleaseManifest(text: string, sourcePath: string): ReleaseManifest {
  const manifest = validateReleaseManifest(readJson(text, sourcePath), sourcePath)
  if (serializeReleaseManifest(manifest) !== text) {
    throw refusal([NOT_CANONICAL], sourcePath)
  }
  return manifest
}
