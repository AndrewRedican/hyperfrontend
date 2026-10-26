/**
 * Resolves a tag, branch or commit of a GitHub repository to the commit it names, so every file
 * is read at one immutable revision.
 *
 * @module types-extract/resolve-ref
 */

import type { FetchText } from './fetch'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { apiUrl, readRemoteJson } from './fetch'

/** The fields of a Git object as the API writes them, before they are checked. */
interface GitObjectFields {
  /** The object's sha. */
  readonly sha?: unknown
  /** `commit`, or `tag` for an annotated tag. */
  readonly type?: unknown
}

/** The part of a Git reference answer that is read. */
interface RefAnswer {
  /** The object the reference points at. */
  readonly object?: GitObjectFields
}

/** A Git object once checked. */
interface GitObject {
  /** The object's sha. */
  readonly sha: string
  /** `commit`, or `tag` for an annotated tag. */
  readonly type: string
}

/**
 * Whether a ref is already a full commit sha.
 *
 * @param ref - The tag, branch or commit as configured
 * @returns True for forty hexadecimal digits
 */
export function isCommitSha(ref: string): boolean {
  return /^[0-9a-f]{40}$/.test(ref)
}

/**
 * The object a reference answer points at.
 *
 * @param answer - The API's answer, or null for a missing reference
 * @returns The sha and type, or null when the answer carries none
 */
function objectOf(answer: unknown): GitObject | null {
  const object = (answer as RefAnswer | null)?.object
  return typeof object?.sha === 'string' && typeof object.type === 'string' ? { sha: object.sha, type: object.type } : null
}

/**
 * Resolves a ref to a commit: a sha as is, a tag (annotated tags followed to their commit), or a
 * branch head.
 *
 * @param fetchText - The fetcher
 * @param repo - The repository, as `owner/name`
 * @param ref - The tag, branch or commit
 * @returns The commit sha
 * @throws {Error} When neither a tag nor a branch has the name
 */
export async function resolveRef(fetchText: FetchText, repo: string, ref: string): Promise<string> {
  if (isCommitSha(ref)) return ref
  for (const kind of ['tags', 'heads']) {
    const found = objectOf(await readRemoteJson(fetchText, apiUrl(repo, `git/ref/${kind}/${ref}`)))
    if (found === null) continue
    if (found.type !== 'tag') return found.sha
    const tag = objectOf(await readRemoteJson(fetchText, apiUrl(repo, `git/tags/${found.sha}`)))
    if (tag === null) throw createError(`${repo}: annotated tag ${ref} does not point at an object`)
    return tag.sha
  }
  throw createError(`${repo}: ${ref} is neither a tag nor a branch`)
}
