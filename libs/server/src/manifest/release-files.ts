import type { ReleaseFile, ReleaseManifest } from './release-format'
import { createHash } from 'node:crypto'
import { lstatSync } from 'node:fs'
import { join, sep, posix } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { readDirectory, readFileBuffer } from '@hyperfrontend/project-scope/core/fs'
import { compareCodePoints, isReleasePath, RELEASE_MANIFEST_FILENAME, validateReleaseManifest } from './release-format'

/** One entry found below the root of a release. */
export interface ReleaseEntry {
  /** Path relative to the root, with the separators of the platform. */
  readonly path: string
  /** `file` for a regular file; `other` for anything else that is no directory, a symbolic link included. */
  readonly kind: 'file' | 'other'
}

/** The file system a release is read through. A function left out is the one that reads the disk, so a spec replaces only what it observes. */
export interface ReleaseFileSystem {
  /** Lists every entry below a root that is no directory, descending into directories and following no symbolic link. */
  readonly list?: (root: string) => readonly ReleaseEntry[]
  /** Reads the bytes of the file at a path, which is the root joined with an entry's path by the platform's separator. */
  readonly read?: (path: string) => Uint8Array
  /** Answers the size in bytes of the regular file at such a path, following no symbolic link, or `null` when no regular file is there. */
  readonly size?: (path: string) => number | null
}

/** What a release manifest is made from. */
export interface CreateReleaseManifestInput {
  /** The directory to index, which is the directory the manifest file belongs in. */
  readonly root: string
  /** The artifact's own name; for a shell, its package name. */
  readonly name: string
  /** The artifact's version, canonical semver 2.0.0, no leading "v". */
  readonly version: string
}

/** One difference between a directory and the manifest that describes it. */
export interface ReleaseVerificationIssue {
  /** The kind of difference, stable across releases so a tool can branch on it. */
  readonly code: 'manifest-not-file' | 'file-missing' | 'file-size-mismatch' | 'file-sha256-mismatch' | 'file-unlisted'
  /** The path of the file below the root, "/" separated, as the disk gave it: unlike the message, it is not quoted. */
  readonly path: string
  /** The whole sentence a tool prints, which opens with the path, quoted when it is one no manifest can list. */
  readonly message: string
}

// note: The control characters a JSON text leaves as they are: U+007F and the C1 range.
const UNESCAPED_CONTROL = /[\u007F-\u009F]/g

/**
 * Hashes bytes with SHA-256.
 *
 * @param bytes - The bytes, or a text that is hashed as its UTF-8 encoding.
 * @returns The digest as 64 lowercase hexadecimal characters.
 */
function sha256Hex(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Lists the entries below a directory on disk, descending into directories and following no symbolic link.
 *
 * @param root - The directory the listing is relative to.
 * @param below - The directory being read, relative to the root.
 * @returns Every entry that is no directory, by its native path relative to the root.
 */
function listEntries(root: string, below = ''): readonly ReleaseEntry[] {
  return readDirectory(join(root, below)).flatMap((entry): readonly ReleaseEntry[] => {
    const path = join(below, entry.name)
    return entry.isDirectory ? listEntries(root, path) : [{ path, kind: entry.isFile ? 'file' : 'other' }]
  })
}

/**
 * Reads the size of a regular file on disk without following a symbolic link.
 *
 * @param path - The native path to examine.
 * @returns The size in bytes, or `null` when the path names nothing or anything but a regular file.
 * @throws {Error} When the path cannot be examined for any reason other than its absence.
 *
 * @example Telling a regular file from a link or a pipe before opening it
 * ```typescript
 * regularFileSize('dist/shell/index.mjs') // => 3
 * regularFileSize('dist/shell/absent.mjs') // => null
 * ```
 */
export function regularFileSize(path: string): number | null {
  try {
    const stats = lstatSync(path)
    return stats.isFile() ? stats.size : null
  } catch (error) {
    const code: unknown = (error as NodeJS.ErrnoException).code
    // why: A path that names nothing, or that passes through a file, is an absent file; any other failure says nothing about the release and is the caller's to see.
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return null
    }
    throw error
  }
}

/**
 * Rewrites a native relative path with the separator a manifest uses.
 *
 * @param path - A path relative to the root, with the separators of the platform.
 * @returns The same path, "/" separated.
 */
function portablePath(path: string): string {
  return path.split(sep).join(posix.sep)
}

/**
 * Quotes a path found on disk for a message a tool prints.
 *
 * @param path - The path below the root, "/" separated.
 * @returns A quoted string with every control character escaped, so a name cannot start a line of its own or reach a terminal raw.
 */
function quotedPath(path: string): string {
  return stringify(path).replace(UNESCAPED_CONTROL, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

/**
 * Computes the digest that identifies a release manifest: the SHA-256 of the bytes of its file.
 *
 * A manifest file is valid only in canonical form, so the digest of a file equals the digest of the serialisation of its content, and one manifest content has one digest. Name and version do not identify the bytes of an artifact; this digest does.
 *
 * @param serialized - The bytes of an `hf-release.json` file, or its text, which is hashed as UTF-8.
 * @returns The digest as 64 lowercase hexadecimal characters.
 *
 * @example Pinning a release by the digest of its manifest
 * ```typescript
 * import { createReleaseManifest, releaseManifestDigest, serializeReleaseManifest } from '@hyperfrontend/server/manifest'
 *
 * const manifest = createReleaseManifest({ root: 'dist/shell', name: '@acme/clock-shell', version: '1.4.0' })
 * const digest = releaseManifestDigest(serializeReleaseManifest(manifest))
 * ```
 */
export function releaseManifestDigest(serialized: Uint8Array | string): string {
  return sha256Hex(serialized)
}

/**
 * Indexes a directory as a release: every regular file below it, dotfiles included, with its size and SHA-256.
 *
 * The manifest file at the root is left out, since a manifest never lists itself. Each file is read once and whole, so a file of 2 GiB or more cannot be indexed, and its size is the length of the bytes read. The result has passed {@link validateReleaseManifest}, so it is ready for `serializeReleaseManifest`.
 *
 * @param input - The directory to index and the identity to stamp on the manifest.
 * @param fileSystem - Replacements for the listing and the read; the disk when left out.
 * @returns The manifest, its files in ascending code point order of their paths.
 * @throws {Error} When an entry below the root is neither a regular file nor a directory, naming each one, the manifest file included; when the directory holds no file; when the name, the version or a file's path is one a manifest cannot hold; and when the disk cannot be read, which includes a file of 2 GiB or more.
 *
 * @example Writing the manifest of a built package
 * ```typescript
 * import { writeFileSync } from 'node:fs'
 * import { join } from 'node:path'
 * import { RELEASE_MANIFEST_FILENAME, createReleaseManifest, serializeReleaseManifest } from '@hyperfrontend/server/manifest'
 *
 * const manifest = createReleaseManifest({ root: 'dist/shell', name: '@acme/clock-shell', version: '1.4.0' })
 * writeFileSync(join('dist/shell', RELEASE_MANIFEST_FILENAME), serializeReleaseManifest(manifest))
 * ```
 */
export function createReleaseManifest(input: CreateReleaseManifestInput, fileSystem?: ReleaseFileSystem): ReleaseManifest {
  const read = fileSystem?.read ?? readFileBuffer
  // why: Only a regular file is left out as the manifest, so a link or a pipe under its name is refused like any other entry that is no file.
  const entries = (fileSystem?.list ?? listEntries)(input.root).filter(
    (entry) => entry.path !== RELEASE_MANIFEST_FILENAME || entry.kind !== 'file'
  )
  const refused = entries
    .filter((entry) => entry.kind !== 'file')
    .map((entry) => portablePath(entry.path))
    .sort(compareCodePoints)
  if (refused.length > 0) {
    throw createError(
      [
        `${input.root}: a release holds regular files only, and these entries are something else:`,
        ...refused.map((path) => `  - ${quotedPath(path)}`),
      ].join('\n')
    )
  }
  const files = entries
    .map((entry): ReleaseFile => {
      const bytes = read(join(input.root, entry.path))
      return { path: portablePath(entry.path), size: bytes.length, sha256: sha256Hex(bytes) }
    })
    .sort((left, right) => compareCodePoints(left.path, right.path))
  return validateReleaseManifest(
    { schema: 1, name: input.name, version: input.version, files },
    join(input.root, RELEASE_MANIFEST_FILENAME)
  )
}

/**
 * Compares one listed file with what the disk holds at its path.
 *
 * @param file - The entry of the manifest.
 * @param path - The native path the entry names under the root.
 * @param fileSystem - The size lookup and the read to use.
 * @returns At most one difference: no regular file, another size, or other bytes; the file is read only when its size matches.
 */
function checkListedFile(
  file: ReleaseFile,
  path: string,
  fileSystem: Required<Omit<ReleaseFileSystem, 'list'>>
): readonly ReleaseVerificationIssue[] {
  const size = fileSystem.size(path)
  if (size === null) {
    return [{ code: 'file-missing', path: file.path, message: `${file.path} is listed but no regular file is there.` }]
  }
  if (size !== file.size) {
    return [{ code: 'file-size-mismatch', path: file.path, message: `${file.path} does not have the listed size.` }]
  }
  return sha256Hex(fileSystem.read(path)) === file.sha256
    ? []
    : [{ code: 'file-sha256-mismatch', path: file.path, message: `${file.path} does not have the listed SHA-256.` }]
}

/**
 * Compares a directory with a release manifest, exactly: an empty result means the directory holds the listed bytes and nothing else.
 *
 * A manifest file at the root that is no regular file is reported first. Each listed file is then checked in manifest order, and reported at most once: as missing when no regular file is at its path, by size without being read, or by its SHA-256. A symbolic link at a listed path is not followed: it is a missing file. Every other entry below the root, the manifest file at the root excepted, is then reported as unlisted, in code point order; a symbolic link to a directory is such an entry, whatever lies behind it. A name that is not valid UTF-8 is never a listed one. A file whose size matches is read whole, so a release cannot hold a file of 2 GiB or more.
 *
 * The digest of the manifest itself is not checked: a caller that pins a release compares `releaseManifestDigest` of the file with the digest it trusts before relying on this result.
 *
 * @param root - The directory the manifest describes.
 * @param manifest - The manifest to hold the directory to.
 * @param fileSystem - Replacements for the listing, the read and the size lookup; the disk when left out.
 * @returns The differences found; empty when there are none.
 * @throws {Error} When the manifest is not a valid one, before the disk is touched, and when the disk cannot be read, which includes a listed file of 2 GiB or more: a failure to read is no verdict on the release.
 *
 * @example Verifying an installed package against its manifest
 * ```typescript
 * import { readFileSync } from 'node:fs'
 * import { join } from 'node:path'
 * import { RELEASE_MANIFEST_FILENAME, parseReleaseManifest, verifyRelease } from '@hyperfrontend/server/manifest'
 *
 * const root = 'node_modules/@acme/clock-shell'
 * const source = join(root, RELEASE_MANIFEST_FILENAME)
 * const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(readFileSync(source))
 * const issues = verifyRelease(root, parseReleaseManifest(text, source))
 * // => [] when the package holds exactly the listed bytes
 * ```
 */
export function verifyRelease(
  root: string,
  manifest: ReleaseManifest,
  fileSystem?: ReleaseFileSystem
): readonly ReleaseVerificationIssue[] {
  // why: The paths of a value that never passed the validator could climb out of the root, and a repeated one would be reported twice.
  const listed = validateReleaseManifest(manifest, join(root, RELEASE_MANIFEST_FILENAME)).files
  const access = { read: fileSystem?.read ?? readFileBuffer, size: fileSystem?.size ?? regularFileSize }
  const differing = listed.flatMap((file) => checkListedFile(file, join(root, file.path), access))
  const known = createSet([RELEASE_MANIFEST_FILENAME, ...listed.map((file) => file.path)])
  const entries = (fileSystem?.list ?? listEntries)(root)
  return [
    ...(entries.some((entry) => entry.path === RELEASE_MANIFEST_FILENAME && entry.kind !== 'file')
      ? [
          {
            code: 'manifest-not-file' as const,
            path: RELEASE_MANIFEST_FILENAME,
            message: `${RELEASE_MANIFEST_FILENAME} is not a regular file.`,
          },
        ]
      : []),
    ...differing,
    ...entries
      .map((entry) => portablePath(entry.path))
      .filter((path) => !known.has(path))
      .sort(compareCodePoints)
      .map((path): ReleaseVerificationIssue => {
        // why: A name from disk that no manifest can list is quoted, since it may hold a line break or a terminal sequence.
        return { code: 'file-unlisted', path, message: `${isReleasePath(path) ? path : quotedPath(path)} is present but not listed.` }
      }),
  ]
}
