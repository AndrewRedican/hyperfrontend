/**
 * Disposable workspaces for the Railway service pin rule: one whose single Railway project
 * installs `@hyperfrontend/features` from the registry beside projects deployed elsewhere, one
 * whose Railway projects install it from no registry, lack it, or have no lock at all, and one per
 * way a project deployed as a built service states its build, two of them with an `hf.json` whose
 * defaults the build target takes, and two whose projects state no name.
 *
 * @module rules/workspace/__test-utils__/railway-workspace
 */

import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createTempDir } from '@hyperfrontend/testing/fs'

/**
 * A project file deploying to a provider.
 *
 * @param name - What the workspace calls the project, or undefined for a project that states no name
 * @param deploy - The deploy metadata
 * @param targets - The targets, when the project states any
 * @returns The file text
 */
const project = (name: string | undefined, deploy: Record<string, string>, targets?: Record<string, unknown>): string =>
  `${stringify({ name, targets, metadata: { deploy } }, null, 2)}\n`

/**
 * The deploy metadata of a project deployed to Railway as a built service.
 *
 * @param service - What the Railway project calls the service
 * @returns The metadata
 */
const built = (service: string): Record<string, string> => ({ provider: 'railway', service, kind: 'service' })

const EXECUTOR = '@hyperfrontend/workspace:service'

/**
 * A workspace configuration giving targets their defaults.
 *
 * @param targetDefaults - The defaults, by executor or by target name
 * @returns The file text
 */
const configuration = (targetDefaults: Record<string, unknown>): string => `${stringify({ targetDefaults }, null, 2)}\n`

/**
 * A lock installing `@hyperfrontend/features`.
 *
 * @param version - The installed version
 * @param resolved - Where it was installed from
 * @returns The file text
 */
const lock = (version: string, resolved: string): string =>
  `${stringify({ packages: { '': {}, 'node_modules/@hyperfrontend/features': { version, resolved } } }, null, 2)}\n`

/** The files of every workspace, by path below the directory that holds them. */
const FILES: Readonly<Record<string, string>> = {
  'clean/apps/alpha/project.json': project('demo-alpha', { provider: 'railway', service: 'alpha' }),
  'clean/apps/alpha/package-lock.json': lock('1.2.3', 'https://registry.npmjs.org/@hyperfrontend/features/-/features-1.2.3.tgz'),
  'clean/apps/site/project.json': project('demo-site', { provider: 'vercel', service: 'site' }),
  'clean/apps/unnamed/project.json': project('demo-unnamed', { provider: 'railway' }),
  'locks/apps/beta/project.json': project('demo-beta', { provider: 'railway', service: 'beta' }),
  'locks/apps/beta/package-lock.json': `${stringify({ packages: { '': {} } })}\n`,
  'locks/apps/gamma/project.json': project('demo-gamma', { provider: 'railway', service: 'gamma' }),
  'locks/apps/gamma/package-lock.json': lock('1.2.3', 'file:../vendor/features-1.2.3.tgz'),
  'locks/apps/delta/project.json': project('demo-delta', { provider: 'railway', service: 'delta' }),
  'built/apps/hello/project.json': project('app-hello', built('hello'), { typecheck: {}, build: { executor: EXECUTOR } }),
  'built/apps/alpha/project.json': project('demo-alpha', { provider: 'railway', service: 'alpha', kind: 'static' }),
  'built/apps/alpha/package-lock.json': lock('1.2.3', 'https://registry.npmjs.org/@hyperfrontend/features/-/features-1.2.3.tgz'),
  'stated/apps/stated/project.json': project('app-stated', built('stated'), {
    build: { executor: EXECUTOR, options: { outputPath: 'out/stated', assets: [] } },
  }),
  'bare/apps/bare/project.json': project('app-bare', built('bare'), { test: null, build: {} }),
  "quoted/apps/o'brien/project.json": project('app-obrien', built('obrien'), { build: { executor: EXECUTOR } }),
  'token/apps/token/project.json': project('app-token', built('token'), {
    build: { executor: EXECUTOR, options: { outputPath: 'out/{projectRoot}' } },
  }),
  'keyed/hf.json': configuration({ [EXECUTOR]: { options: { outputPath: 'build/{projectRoot}' } } }),
  'keyed/apps/keyed/project.json': project('app-keyed', built('keyed'), { build: { executor: EXECUTOR } }),
  'named/hf.json': configuration({ build: { executor: EXECUTOR } }),
  'named/apps/named/project.json': project('app-named', built('named'), { build: {} }),
  'slashed/apps/slashed/project.json': project('app-slashed', built('slashed'), {
    build: { executor: EXECUTOR, options: { outputPath: './out/slashed/' } },
  }),
  'misnamed/apps/misnamed/project.json': project('app-misnamed', built('misnamed'), { bundle: { executor: EXECUTOR } }),
  'second/apps/second/project.json': project('app-second', built('second'), {
    bundle: { executor: EXECUTOR, options: { outputPath: 'out/bundle' } },
    build: { executor: EXECUTOR, options: { outputPath: 'out/second' } },
  }),
  'spaced/apps/my app/project.json': project('app-spaced', built('spaced'), { build: { executor: EXECUTOR } }),
  'nameless/apps/nameless/project.json': project(undefined, built('nameless'), { build: { executor: EXECUTOR } }),
  'anonymous/apps/anonymous/project.json': project(undefined, { provider: 'railway', service: 'anonymous' }),
  'anonymous/apps/anonymous/package-lock.json': lock('1.2.3', 'https://registry.npmjs.org/@hyperfrontend/features/-/features-1.2.3.tgz'),
}

/** The workspaces, by the directory that holds each. */
export type RailwayWorkspace =
  | 'clean'
  | 'locks'
  | 'built'
  | 'stated'
  | 'bare'
  | 'quoted'
  | 'token'
  | 'keyed'
  | 'named'
  | 'slashed'
  | 'misnamed'
  | 'second'
  | 'spaced'
  | 'nameless'
  | 'anonymous'

/** The paths the specs lint as. */
export interface RailwayWorkspaces {
  /** The directory holding every workspace. */
  readonly root: string
  /** A file of a workspace, whether or not it exists. */
  readonly file: (workspace: RailwayWorkspace, path: string) => string
  /** Removes every workspace. */
  readonly remove: () => void
}

/**
 * Writes every workspace to a temporary directory.
 *
 * @returns Their paths
 */
export function createRailwayWorkspaces(): RailwayWorkspaces {
  const directory = createTempDir({ prefix: 'lint-railway-', tree: FILES })
  return {
    root: directory.path,
    file: (workspace, path) => directory.resolve(workspace, path),
    remove: directory.remove,
  }
}
