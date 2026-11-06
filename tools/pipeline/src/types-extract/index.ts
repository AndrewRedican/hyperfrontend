/**
 * Extracts upstream-compatible TypeScript declarations from a repository at a locked commit, and
 * verifies that the generated files are current.
 *
 * @module types-extract
 */

import type { TypesExtractConfig } from './config'
import type { Provenance } from './emit'
import type { FetchText } from './fetch'
import type { LockedSource, LockFile } from './lock'
import type { ResolutionContext } from './resolve-name'
import type { SourceFiles } from './sources'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { compareGenerated } from './check'
import { validateConfig } from './config'
import { emit } from './emit'
import { readRemoteFile } from './fetch'
import { parseLock, serializeLock, staleSources } from './lock'
import { renderNotice, renderReport } from './report'
import { resolveRef } from './resolve-ref'
import { sourcePath } from './sources'
import { walk } from './walk'

export type { BoundaryConfig, HeaderConfig, RequestConfig, SourceConfig, TypesExtractConfig } from './config'
export type { FetchText } from './fetch'
export type { LockedSource, LockFile } from './lock'
export { compareGenerated } from './check'
export { validateConfig } from './config'
export { createFetch } from './fetch'
export { parseLock, serializeLock, staleSources } from './lock'
export { resolveRef } from './resolve-ref'

/** What an extraction run is given to reach the world. */
export interface ExtractIo {
  /** Reads a workspace-relative file, or null when it does not exist. */
  readonly readFile: (path: string) => string | null
  /** Writes a workspace-relative file, creating directories. */
  readonly writeFile: (path: string, text: string) => void
  /** Fetches a URL. */
  readonly fetchText: FetchText
  /** Reports progress, one line at a time. */
  readonly log: (line: string) => void
}

/** What a run does with the generated files. */
export type ExtractMode = 'write' | 'check' | 'update'

/**
 * Generates every file of a configuration against locked sources.
 *
 * @param config - The configuration
 * @param lock - The lock, pinning every configured source
 * @param io - The world
 * @returns The generated texts, by workspace-relative path
 */
export async function extract(config: TypesExtractConfig, lock: LockFile, io: ExtractIo): Promise<Map<string, string>> {
  const files: SourceFiles = createMap()
  // note: the configured prefixes end with a slash, which the join keeps, so `src/a.ts` never matches `src-other/`.
  const include = entries(config.sources).flatMap(([name, source]) => source.include.map((prefix) => sourcePath(name, prefix)))
  const locked = (name: string): LockedSource => {
    const source = lock.sources[name]
    if (source === undefined) throw createError(`the lock does not pin the source ${name}`)
    return source
  }
  const read = async (prefixed: string): Promise<string | null> => {
    const name = prefixed.slice(0, prefixed.indexOf('/'))
    const source = locked(name)
    return readRemoteFile(io.fetchText, source.repo, source.sha, prefixed.slice(name.length + 1))
  }
  const licenses = createMap<string, string>()
  for (const [name, source] of entries(config.sources)) {
    const license = await read(sourcePath(name, source.license ?? 'LICENSE'))
    if (license === null) throw createError(`${name}: the repository has no ${source.license ?? 'LICENSE'} file at the locked commit`)
    licenses.set(name, license)
  }
  let result = walk(config.requests, config.boundary, { files, include, indexes: createMap() } satisfies ResolutionContext)
  while (result.pending.length > 0) {
    io.log(`reading ${result.pending.length} file${result.pending.length === 1 ? '' : 's'}`)
    await promiseAll(result.pending.map(async (path) => files.set(path, await read(path))))
    result = walk(config.requests, config.boundary, { files, include, indexes: createMap() })
  }
  const sourceName = keys(config.sources)[0] as string
  const license = licenses.get(sourceName) as string
  const copyright = license.split(/\r?\n/).find((line) => line.startsWith('Copyright')) ?? `Copyright of ${locked(sourceName).repo}`
  const provenance: Provenance = { repo: locked(sourceName).repo, ref: locked(sourceName).ref, sha: locked(sourceName).sha, copyright }
  const emitted = emit(result, {
    header: config.header,
    boundary: config.boundary,
    provenance,
    index: config.index,
    indexModule: config.indexModule,
  })
  const generated = createMap<string, string>(emitted.files)
  const context = { header: config.header, provenance, summaries: emitted.summaries, entries: emitted.entries }
  generated.set(config.report, renderReport(context))
  generated.set(config.notice, renderNotice(context, license))
  return generated
}

/**
 * Runs an extraction: `write` generates the files and the lock, `update` re-resolves every source
 * first, `check` regenerates in memory and fails on any difference from the disk.
 *
 * @param config - The configuration
 * @param mode - Whether the files are written, checked, or written after every ref is re-resolved
 * @param io - The world
 * @returns The exit code: zero on success, one on a failed check or an invalid configuration
 */
export async function runTypesExtract(config: TypesExtractConfig, mode: ExtractMode, io: ExtractIo): Promise<number> {
  const problems = validateConfig(config)
  if (problems.length > 0) {
    for (const problem of problems) io.log(`configuration: ${problem}`)
    return 1
  }
  const lockText = io.readFile(config.lockFile)
  const lock = lockText === null ? null : parseLock(lockText)
  const stale = mode === 'update' ? keys(config.sources) : staleSources(lock, config)
  if (mode === 'check' && stale.length > 0) {
    io.log(`${config.lockFile} does not pin ${stale.join(', ')} as configured; run \`${config.header.regenerate}\` to resolve and lock`)
    return 1
  }
  const sources: Record<string, LockedSource> = { ...lock?.sources }
  for (const name of stale) {
    const source = config.sources[name] as TypesExtractConfig['sources'][string]
    const sha = await resolveRef(io.fetchText, source.repo, source.ref)
    io.log(`${name}: ${source.repo}@${source.ref} is ${sha}`)
    sources[name] = { repo: source.repo, ref: source.ref, sha }
  }
  const resolved: LockFile = { sources }
  const generated = await extract(config, resolved, io)
  const newLockText = serializeLock(resolved)
  if (mode === 'check') {
    const differences = compareGenerated(generated, io.readFile)
    for (const path of differences.missing) io.log(`missing: ${path}`)
    for (const path of differences.stale) io.log(`stale: ${path}`)
    if (differences.missing.length + differences.stale.length === 0) {
      io.log(`${generated.size} generated files are current`)
      return 0
    }
    io.log(`run \`${config.header.regenerate}\` to regenerate`)
    return 1
  }
  let written = 0
  for (const [path, text] of generated) {
    if (io.readFile(path) === text) continue
    io.writeFile(path, text)
    written += 1
  }
  if (lockText !== newLockText) {
    io.writeFile(config.lockFile, newLockText)
    written += 1
  }
  io.log(`${written} of ${generated.size + 1} files written`)
  return 0
}
