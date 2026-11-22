import type { ReleaseFileSystem } from '../manifest/release-files'
import type { FatalFields } from './run-lines'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createTextDecoder } from '@hyperfrontend/immutable-api-utils/built-in-copy/encoding'
import { createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { isFinite } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { freeze, isFrozen, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { symbolFor } from '@hyperfrontend/immutable-api-utils/built-in-copy/symbol'
import { readFileBuffer } from '@hyperfrontend/project-scope/core/fs'
import { regularFileSize, releaseManifestDigest, verifyRelease } from '../manifest/release-files'
import { parseReleaseManifest, RELEASE_MANIFEST_FILENAME } from '../manifest/release-format'
import { isPlainObject } from './headers'
import { boundedLines, faultFields, listLines } from './run-lines'

/** What a service build embeds in the bundle it writes, on `globalThis` under `Symbol.for('@hyperfrontend/server/service-build')`. */
export interface ServiceBuildStamp {
  /** The directory of the built main, where `hf-release.json` sits. */
  readonly directory: string
  /** The digest of the immutable section the service was built with: the SHA-256, in 64 lowercase hexadecimal characters, of the UTF-8 bytes of `JSON.stringify` of the section. */
  readonly immutable: string
}

/** What a service build takes from the kernel the service is bundled with. Frozen. */
export interface ServiceBuildSeal {
  /** One JavaScript statement for the top of the CommonJS main the build writes, after a `'use strict'` directive. When the main is loaded it leaves a `ServiceBuildStamp` where `runService` finds it. */
  readonly statement: string
  /** The digest of the immutable section, as `ServiceBuildStamp.immutable` states it. */
  readonly digest: string
  /** The text under which the stamp is registered. The runner's own code holds it, so a bundle that holds it only inside `statement` does not run through `runService`. */
  readonly key: string
}

/** What checking the release of a built service found. */
export interface ReleaseCheck {
  /** The detail lines of the fatal block, as they are to be written and bounded in number; empty when the directory holds exactly the bytes the build wrote. */
  readonly issues: readonly string[]
  /** The name and the code of what the verification threw; empty when it gave a verdict. */
  readonly fields: FatalFields
  /** The digest of the release manifest's bytes, or empty text when there is an issue. */
  readonly release: string
  /** The digest of the immutable section the stamp states, or empty text for a malformed stamp. */
  readonly immutable: string
}

/** The text the build stamp is registered under, the one literal both the seal and the reader of the stamp use. */
export const BUILD_KEY = '@hyperfrontend/server/service-build'

// note: A SHA-256 as a stamp states it.
const DIGEST = /^[0-9a-f]{64}$/

/**
 * Passes a member of a section on to the JSON writer, or refuses it.
 *
 * @param _key - The member's key, which plays no part.
 * @param member - The member, after its own `toJSON` when it has one.
 * @returns The member as it is.
 * @throws {TypeError} For a member the JSON writer would drop or write as `null`: `undefined`, a function, a symbol, and a number that is not finite.
 */
function jsonMember(_key: string, member: unknown): unknown {
  if (
    member === undefined ||
    typeof member === 'function' ||
    typeof member === 'symbol' ||
    (typeof member === 'number' && !isFinite(member))
  ) {
    throw createTypeError('not a JSON value')
  }
  return member
}

/**
 * Computes the digest of an immutable section: the SHA-256 of the UTF-8 bytes of its JSON text, written with no indentation.
 * Key order is the object's own, so two sections with the same members in another order have different digests.
 *
 * @param value - The section.
 * @returns The digest as 64 lowercase hexadecimal characters, or `null` for a value JSON cannot represent, at any depth: `undefined`, a function, a symbol, a BigInt, a number that is not finite, or a cycle.
 *
 * @example A section and two values that are none
 * ```typescript
 * immutableDigest({ a: 1 }) // => '015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862'
 * immutableDigest(() => 1) // => null
 * immutableDigest({ maxBodyBytes: Infinity }) // => null
 * ```
 */
export function immutableDigest(value: unknown): string | null {
  try {
    // why: the JSON writer drops an undefined member and writes a number that is not finite as null, so sections that differ would share one digest
    return createHash('sha256').update(stringify(value, jsonMember), 'utf8').digest('hex')
  } catch {
    return null
  }
}

/**
 * Reads the build stamp a sealed main left behind.
 *
 * @param holder - The object the stamp is registered on, which is `globalThis` for a running service.
 * @returns Whatever is registered, unjudged, or `undefined` when nothing is.
 *
 * @example Telling a built service from one run from source
 * ```typescript
 * readStamp(globalThis) // => undefined, unless a sealed main was loaded
 * ```
 */
export function readStamp(holder: object): unknown {
  return (holder as Record<symbol, unknown>)[symbolFor(BUILD_KEY)]
}

/**
 * Judges a build stamp.
 *
 * @param stamp - Whatever was registered or injected as the stamp.
 * @returns The stamp when it is an object with a non-empty text for its directory and a SHA-256 for its section, else `null`; it never throws.
 */
function soundStamp(stamp: unknown): ServiceBuildStamp | null {
  try {
    if (typeof stamp === 'object' && stamp !== null) {
      const { directory, immutable } = stamp as Record<string, unknown>
      if (typeof directory === 'string' && directory !== '' && typeof immutable === 'string' && DIGEST.test(immutable)) {
        return { directory, immutable }
      }
    }
  } catch {
    // why: a getter or a proxy trap may throw while the stamp is read, and a stamp that cannot be read is a malformed one
  }
  return null
}

/**
 * Reads the release manifest of a directory, as its bytes and as text.
 *
 * @param directory - The directory of the built main.
 * @param files - The injected file system, or `undefined` for the disk.
 * @returns The bytes and their text, or `null` when no regular file is there, the file cannot be read or it does not hold UTF-8.
 */
function readManifest(directory: string, files: ReleaseFileSystem | undefined): readonly [Uint8Array, string] | null {
  try {
    const path = join(directory, RELEASE_MANIFEST_FILENAME)
    // why: a symbolic link would be followed out of the directory and a pipe would block the boot, so only a regular file is ever opened
    if ((files?.size ?? regularFileSize)(path) === null) {
      return null
    }
    const bytes = (files?.read ?? readFileBuffer)(path)
    // why: a byte order mark and a malformed sequence must fail the check, since the digest is of the bytes and one content has one digest
    return [bytes, createTextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)]
  } catch {
    return null
  }
}

/**
 * Holds the directory of a built service to its release manifest.
 *
 * @param directory - The directory of the built main.
 * @param text - The text of its `hf-release.json`.
 * @param files - The injected file system, or `undefined` for the disk.
 * @returns The detail lines, bounded in number, and the fields of a fatal block; no line when the directory holds exactly the listed bytes.
 */
function verifyDirectory(directory: string, text: string, files: ReleaseFileSystem | undefined): Pick<ReleaseCheck, 'issues' | 'fields'> {
  let manifest
  try {
    manifest = parseReleaseManifest(text, RELEASE_MANIFEST_FILENAME)
  } catch (error) {
    // why: the message of the validator names the file and its problems and never a value, so it is passed on as it is
    return { issues: boundedLines((error as Error).message.split(/\r?\n/)), fields: {} }
  }
  try {
    return { issues: boundedLines(listLines(verifyRelease(directory, manifest, files).map((issue) => issue.message))), fields: {} }
  } catch (error) {
    // why: a failure to read is no verdict on the release, and its message may hold a path, so only its name and code are kept
    return { issues: listLines(['the release could not be read.']), fields: faultFields(error) }
  }
}

/**
 * Checks the release of a built service before anything of it runs: the stamp, the manifest beside the main, and every file of the directory against it.
 *
 * @param stamp - Whatever was registered or injected as the build stamp.
 * @param files - Replacements for the listing, the read and the size lookup; the disk when left out.
 * @returns The issues found, the digest of the manifest when there is none, and the section digest of the stamp; it never throws.
 *
 * @example Refusing a boot whose directory changed
 * ```typescript
 * const checked = checkRelease(readStamp(globalThis))
 * if (checked.issues.length > 0) {
 *   process.stderr.write(fatalBlock('release', checked.fields, checked.issues))
 * }
 * ```
 */
export function checkRelease(stamp: unknown, files?: ReleaseFileSystem): ReleaseCheck {
  const sound = soundStamp(stamp)
  if (sound === null) {
    return { issues: listLines(['the build stamp is malformed.']), fields: {}, release: '', immutable: '' }
  }
  const read = readManifest(sound.directory, files)
  if (read === null) {
    return { issues: listLines([`${RELEASE_MANIFEST_FILENAME} could not be read.`]), fields: {}, release: '', immutable: sound.immutable }
  }
  const verified = verifyDirectory(sound.directory, read[1], files)
  return { ...verified, release: verified.issues.length === 0 ? releaseManifestDigest(read[0]) : '', immutable: sound.immutable }
}

/**
 * Freezes a value deep: every plain object and array reachable through own enumerable string keys.
 * A value that is already frozen is not descended into, which is also what ends a cycle.
 *
 * @param value - The immutable section of a service.
 * @returns The same value.
 *
 * @example A section that can no longer be written to
 * ```typescript
 * const section = freezeDeep({ limits: { names: 3 } })
 * section.limits.names = 4 // throws a TypeError in strict code
 * ```
 */
export function freezeDeep<Value>(value: Value): Value {
  if ((isArray(value) || isPlainObject(value)) && !isFrozen(value)) {
    freeze(value)
    for (const key of keys(value)) {
      freezeDeep((value as Record<string, unknown>)[key])
    }
  }
  return value
}

/**
 * Seals a service build: gives the statement that stamps the bundle and the digest of the immutable section.
 * The statement reads `__dirname`, so it is for a CommonJS main only, and it holds no path, so a bundle does not depend on where it was built.
 * It is the build tool's half of the release check `runService` makes, and of no use to a service.
 *
 * @param immutable - The immutable section the service is built with.
 * @returns The statement, the digest and the text the stamp is registered under, frozen.
 * @throws {TypeError} When the section is not a JSON value, which includes one that holds, at any depth, `undefined`, a function, a symbol, a BigInt or a number that is not finite. The message holds nothing of the section.
 *
 * @example Writing the top of a built main
 * ```typescript
 * import { sealServiceBuild } from '@hyperfrontend/server'
 *
 * const seal = sealServiceBuild({ greeting: 'Hello' })
 * const banner = ["'use strict';", seal.statement].join('\n')
 * // 'use strict';
 * // globalThis[Symbol.for("@hyperfrontend/server/service-build")] = Object.freeze({ directory: __dirname, immutable: "<64 hexadecimal characters>" });
 * ```
 */
export function sealServiceBuild(immutable: unknown): ServiceBuildSeal {
  const digest = immutableDigest(immutable)
  if (digest === null) {
    throw createTypeError('sealServiceBuild: the immutable section must be a JSON value.')
  }
  return freeze({
    statement: `globalThis[Symbol.for(${stringify(BUILD_KEY)})] = Object.freeze({ directory: __dirname, immutable: ${stringify(digest)} });`,
    digest,
    key: BUILD_KEY,
  })
}
