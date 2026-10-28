/**
 * The role a file plays in its project: production source, spec, test or lint configuration,
 * build configuration, script, documentation or asset. The role of the importing file qualifies
 * every edge it draws, so a spec's import never looks like a production dependency.
 *
 * @module graph/roles
 */

import { posix } from 'node:path'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** The roles a file can play. */
export const Role = freeze({
  Production: 'production',
  Spec: 'spec',
  TestConfig: 'test-config',
  LintConfig: 'lint-config',
  BuildConfig: 'build-config',
  Script: 'script',
  Docs: 'docs',
  Asset: 'asset',
} as const)

/** One of the roles. */
export type Role = (typeof Role)[keyof typeof Role]

/**
 * The exclusions of the `production` named input this module implements, written as `nx.json`
 * writes them. A spec compares the list with the workspace's `nx.json`, so an exclusion added
 * there without a matching rule here is noticed rather than silently treated as production.
 */
export const PRODUCTION_EXCLUSIONS = freeze([
  '!{projectRoot}/lint.config.ts',
  '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
  '!{projectRoot}/tsconfig.spec.json',
  '!{projectRoot}/test.config.ts',
  '!{projectRoot}/src/test-setup.[jt]s',
  '!{projectRoot}/test-setup.[jt]s',
] as const)

/** The extensions of files the graph parses as code. */
const CODE_EXTENSIONS = freeze(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'] as const)

/** The extensions a spec or test file carries, the way the `production` exclusion spells them. */
const SPEC_EXTENSIONS = freeze(['.ts', '.tsx', '.js', '.jsx'] as const)

/** Configuration files a project's targets read, by basename. */
const BUILD_CONFIG_FILES = freeze(['project.json', 'package.json', 'nx.json', 'tsconfig.json', 'tsconfig.base.json'] as const)

/**
 * Whether a basename is a spec, test or snapshot as the `production` exclusion
 * `?(*.)+(spec|test).[jt]s?(x)?(.snap)` reads it: an optional `.snap`, a script extension, and a
 * last dotted segment made of `spec` and `test`.
 *
 * @param basename - The last segment of the file's path
 * @returns True for a spec, test or snapshot file
 */
function isSpecFile(basename: string): boolean {
  const name = basename.endsWith('.snap') ? basename.slice(0, -'.snap'.length) : basename
  const extension = SPEC_EXTENSIONS.find((candidate) => name.endsWith(candidate))
  if (extension === undefined) return false
  const stem = name.slice(0, -extension.length)
  const last = stem.slice(stem.lastIndexOf('.') + 1)
  return last.length > 0 && last.replaceAll('spec', '').replaceAll('test', '') === ''
}

/**
 * The role of a file within its project.
 *
 * @param file - The path to classify, workspace-relative and POSIX
 * @param projectRoot - The owning project's root, workspace-relative and POSIX; `.` for the workspace itself
 * @returns Which role the file plays
 */
export function roleOf(file: string, projectRoot: string): Role {
  const relative = projectRoot === '.' || !file.startsWith(`${projectRoot}${posix.sep}`) ? file : file.slice(projectRoot.length + 1)
  const segments = relative.split(posix.sep)
  const basename = posix.basename(relative)
  if (relative === 'lint.config.ts' || relative === 'lint.base.config.ts') return Role.LintConfig
  if (relative === 'test.config.ts' || relative === 'tsconfig.spec.json' || isTestSetup(relative)) return Role.TestConfig
  if (isSpecFile(basename) || segments.includes('__test-utils__')) return Role.Spec
  if (BUILD_CONFIG_FILES.includes(basename as (typeof BUILD_CONFIG_FILES)[number]) || isTsconfig(basename)) return Role.BuildConfig
  if (segments[0] === 'scripts' && segments.length > 1) return Role.Script
  if (posix.extname(basename) === '.md' || (segments[0] === 'docs' && segments.length > 1)) return Role.Docs
  return CODE_EXTENSIONS.some((extension) => basename.endsWith(extension)) ? Role.Production : Role.Asset
}

/**
 * Whether a project-relative path is the test setup module the `production` exclusions name.
 *
 * @param relative - The path within the project
 * @returns True for `test-setup.ts` or `test-setup.js` at the root or under `src/`
 */
function isTestSetup(relative: string): boolean {
  const name = relative.startsWith('src/') ? relative.slice('src/'.length) : relative
  return name === 'test-setup.ts' || name === 'test-setup.js'
}

/**
 * Whether a basename is a TypeScript configuration file.
 *
 * @param basename - The file's basename
 * @returns True for `tsconfig.json` and every `tsconfig.<name>.json`
 */
function isTsconfig(basename: string): boolean {
  return basename.startsWith('tsconfig.') && basename.endsWith('.json')
}
