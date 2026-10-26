import { REPO_URL } from '@/lib/site'

/** The branch the main workflow records its runs and the graph on. */
export const RECORDS_BRANCH = 'ci-records'

/** `owner/name` of the repository, from the canonical repository URL. */
const REPOSITORY = REPO_URL.replace('https://github.com/', '')

/** Where the records are read, without a token: raw files of the records branch. */
export const RECORDS_URL = `https://raw.githubusercontent.com/${REPOSITORY}/${RECORDS_BRANCH}`

/** The repository's REST API root. */
export const API_URL = `https://api.github.com/repos/${REPOSITORY}`

/** The route of the dependency explorer. */
export const GRAPH_ROUTE = '/docs/contributing/graph/'

/** The route of the pipeline explorer. */
export const PIPELINE_ROUTE = '/docs/contributing/pipeline/'

/** Where a reader's optional GitHub token is kept, in their own browser alone. */
export const TOKEN_STORAGE_KEY = 'hyperfrontend-github-token'

/** How often a running pipeline is re-read, in milliseconds. */
export const LIVE_POLL_MS = 60_000

/** The workflow whose runs the live view lists. */
export const CI_WORKFLOW_FILE = 'ci-main.yml'

/** The pull-request workflow, listed beside the main one. */
export const PR_WORKFLOW_FILE = 'ci-pr.yml'

/**
 * The page of a file at a commit on GitHub.
 *
 * @param sha - The commit
 * @param file - The file, workspace-relative
 * @param line - The line to point at, or null
 * @returns The address of the file on GitHub
 */
export function sourceUrl(sha: string, file: string, line: number | null): string {
  return `${REPO_URL}/blob/${sha}/${file}${line === null ? '' : `#L${line}`}`
}
