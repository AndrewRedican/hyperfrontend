import type { FixtureTree } from './sample-projects/tree'
import { tmpdir } from 'node:os'
import { after } from 'node:test'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createTempDir, writeTree } from '@hyperfrontend/testing/fs'
import { FRAMEWORK_FIXTURES } from './sample-projects/frameworks'
import { PROJECT_FIXTURES } from './sample-projects/projects'
import { TOOLING_FIXTURES } from './sample-projects/tooling'
import { WORKSPACE_FIXTURES } from './sample-projects/workspaces'

/** Every sample project the suites analyse, keyed by the directory it is written to. */
const FIXTURES: Readonly<Record<string, FixtureTree>> = {
  ...PROJECT_FIXTURES,
  ...TOOLING_FIXTURES,
  ...FRAMEWORK_FIXTURES,
  ...WORKSPACE_FIXTURES,
}

/**
 * Write every sample project under a directory, one subdirectory per fixture.
 *
 * The samples are held as text rather than checked in as files, so the repository carries no manifest or lockfile that dependency scanners would mistake for a real one.
 *
 * @param parent - Directory to create the fixture root in. Defaults to the system temporary directory.
 * @returns Absolute path of the fixture root, which the calling spec file deletes when it finishes.
 *
 * @example Analysing one of the sample projects
 * ```typescript
 * const FIXTURES_DIR = writeFixtures()
 * analyzeProject(join(FIXTURES_DIR, 'minimal-project'))
 * ```
 */
export function writeFixtures(parent: string = tmpdir()): string {
  const root = createTempDir({ parent, prefix: 'project-scope-fixtures-' })
  for (const [name, tree] of entries(FIXTURES)) writeTree(root.mkdir(name), tree)
  after(() => root.remove())
  return root.path
}

/** Where {@link writeNestedFixtures} put the sample projects and the workspace around them. */
export interface NestedFixtures {
  /** Absolute path of the enclosing workspace, which holds `nx.json` and a `.git` directory. */
  workspace: string
  /** Absolute path of the fixture root inside it. */
  fixtures: string
}

/**
 * Write every sample project inside a throwaway Nx workspace with its own git directory.
 *
 * The workspace stands in for a repository the samples are nested in, for suites that check how detection climbs out of a project to the root above it.
 *
 * @returns The workspace and fixture root, both deleted when the calling spec file finishes.
 *
 * @example Climbing from a sample project to the workspace around it
 * ```typescript
 * const { workspace, fixtures } = writeNestedFixtures()
 * findGitRoot(join(fixtures, 'minimal-project')) // workspace
 * ```
 */
export function writeNestedFixtures(): NestedFixtures {
  const workspace = createTempDir({ prefix: 'project-scope-workspace-', tree: { 'nx.json': '{}\n' } })
  workspace.mkdir('.git')
  after(() => workspace.remove())
  return { workspace: workspace.path, fixtures: writeFixtures(workspace.path) }
}
