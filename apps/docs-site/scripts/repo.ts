import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

const WORKSPACE_ROOT = resolve(__dirname, '../../..')

/** npm repository descriptor, whose `url` carries the canonical coordinates. */
interface RepositoryField {
  /** Clone URL the repository is published under */
  url?: string
}

/** Shape of the workspace manifest fields these constants derive from. */
interface WorkspaceManifest {
  /** npm repository descriptor */
  repository?: RepositoryField
}

/**
 * Reads the canonical repository URL from the workspace manifest and normalises
 * it to a plain browsable `https://host/owner/name` form.
 *
 * The manifest spells the value as an npm clone URL
 * (`git+https://host/owner/name.git`), which no reader here wants.
 *
 * @returns Canonical repository URL without a `.git` suffix or trailing slash
 */
function readRepoUrl(): string {
  const manifestPath = join(WORKSPACE_ROOT, 'package.json')
  const manifest = parse(readFileSync(manifestPath, 'utf8')) as WorkspaceManifest
  const declared = manifest.repository?.url

  if (declared === undefined || declared === '') {
    throw createError(`Workspace manifest at ${manifestPath} declares no repository.url`)
  }

  return declared
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
}

/**
 * Canonical GitHub repository URL, without a trailing slash.
 *
 * Derived from the workspace manifest rather than written out here, so moving
 * the repository between accounts or organisations is a one-line change that
 * every generator and validator picks up.
 *
 * @example Composing an issues link
 * ```ts
 * const issues = `${REPO_URL}/issues`
 * ```
 */
export const REPO_URL = readRepoUrl()

/**
 * Base URL for linking a file on the default branch, without a trailing slash.
 * A workspace-relative path and an optional `#L{line}` fragment compose onto it.
 *
 * @example Linking a source file
 * ```ts
 * const source = `${REPO_BLOB_BASE}/libs/logging/src/index.ts#L1`
 * ```
 */
export const REPO_BLOB_BASE = `${REPO_URL}/blob/main`

/**
 * Base URL for linking a directory on the default branch, without a trailing
 * slash. A workspace-relative directory path composes onto it.
 *
 * @example Linking a directory
 * ```ts
 * const dir = `${REPO_TREE_BASE}/apps/demos/clock`
 * ```
 */
export const REPO_TREE_BASE = `${REPO_URL}/tree/main`
