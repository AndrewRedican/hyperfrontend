/**
 * The `library` generator: a TypeScript library of the workspace, with its project, manifest,
 * TypeScript, lint and test configuration, and its path alias.
 *
 * @module generators/library/generator
 */

import type { Tree } from '../../runner/contract'
import type { LibraryGeneratorOptions } from './options'
import { join } from 'node:path'
import { runGenerator } from '../../runner/generators'
import { formatFiles } from '../shared/format'
import { names } from '../shared/names'
import { readRootManifest } from '../shared/package-json'
import { joinPathFragments, offsetFromRoot } from '../shared/paths'
import { scopeOf, scopedName } from '../shared/scope'
import { generateFiles } from '../shared/templates'
import { writeJson } from '../shared/tree'
import { addTsConfigPath } from '../shared/tsconfig-paths'

/** The generator a publishable library is handed to once it exists. */
const MAKE_PUBLISHABLE = 'make-publishable'

// why: the CommonJS build of this module has no import.meta.dirname, and the ES module, which the specs load, has no __dirname
/* node:coverage ignore next 1 */
const TEMPLATES = join(typeof __dirname === 'string' ? __dirname : import.meta.dirname, 'files')

/** The options settled. */
export interface LibraryPlan {
  /** The library's name, as a file name */
  name: string
  /** The project's name */
  projectName: string
  /** The package's name */
  packageName: string
  /** The project's directory, relative to the root */
  projectRoot: string
  /** The description */
  description: string
  /** The tags */
  tags: string[]
  /** The path from the project to the root */
  offsetFromRoot: string
}

/**
 * The scope as a package name carries it.
 *
 * @param scope - A scope with or without its `@`, or undefined
 * @returns The scope with its `@`, or undefined for none
 */
function withAt(scope: string | undefined): string | undefined {
  if (scope === undefined || scope === '') return undefined
  return scope.startsWith('@') ? scope : `@${scope}`
}

/**
 * Settles the options: the names, the directory and the defaults the root manifest gives.
 *
 * @param tree - The tree, whose root manifest gives the default scope
 * @param options - The options as given
 * @returns The names, the root and the description the generator writes from
 *
 * @example The names a spelling and the root manifest's scope settle to
 * ```typescript
 * planLibrary(tree, { name: 'DataUtils', directory: 'libs/utils' })
 * // => {
 * //   name: 'data-utils',
 * //   projectName: 'data-utils',
 * //   packageName: '@acme/data-utils',
 * //   projectRoot: 'libs/utils/data-utils',
 * //   description: 'DataUtils library.',
 * //   tags: [],
 * //   offsetFromRoot: '../../../',
 * // } when the root package.json is named @acme/workspace
 * ```
 */
export function planLibrary(tree: Tree, options: LibraryGeneratorOptions): LibraryPlan {
  const name = names(options.name).fileName
  const projectRoot = joinPathFragments(options.directory ?? 'libs', name)
  const scope = withAt(options.scope) ?? scopeOf(readRootManifest(tree).name ?? '')
  return {
    name,
    projectName: options.projectName ?? name,
    packageName: options.packageName ?? scopedName(scope, name),
    projectRoot,
    description: options.description ?? `${names(name).className} library.`,
    tags: options.tags ?? [],
    offsetFromRoot: offsetFromRoot(projectRoot),
  }
}

/**
 * Writes the library's `package.json`: an ES module package, private until it is made publishable,
 * with the licence and the repository the root manifest states.
 *
 * @param tree - The tree written to
 * @param plan - The settled options
 */
function writePackageJson(tree: Tree, plan: LibraryPlan): void {
  const root = readRootManifest(tree)
  const repository = root.repository
  writeJson(tree, joinPathFragments(plan.projectRoot, 'package.json'), {
    name: plan.packageName,
    version: '0.0.0',
    description: plan.description,
    ...(root.license === undefined ? {} : { license: root.license }),
    ...(repository === undefined
      ? {}
      : { repository: typeof repository === 'string' ? repository : { ...repository, directory: plan.projectRoot } }),
    // why: the configurations beside the sources are ES modules, and Node reads how to load them from the nearest manifest
    type: 'module',
    private: true,
    exports: { '.': './src/index.js', './package.json': './package.json' },
  })
}

/**
 * Writes the library's `project.json`: a library with the `typecheck`, `test` and `build` targets
 * the workspace's defaults configure, the build in both module formats.
 *
 * @param tree - The tree written to
 * @param plan - The settled options
 */
function writeProjectJson(tree: Tree, plan: LibraryPlan): void {
  writeJson(tree, joinPathFragments(plan.projectRoot, 'project.json'), {
    name: plan.projectName,
    description: plan.description,
    sourceRoot: '{projectRoot}/src',
    projectType: 'library',
    tags: plan.tags,
    // why: a library builds in both module formats from the start, so the workspace's build, affected and e2e commands have something to run before it is published
    targets: { typecheck: {}, test: {}, build: { options: { esm: {}, cjs: {} } } },
  })
}

/**
 * Creates a library: its manifests, the files of its templates, and its alias in
 * `tsconfig.base.json`; then, for a publishable one, runs the generator named
 * `make-publishable` on it, the workspace's own where it provides one.
 *
 * @param tree - The tree, rooted at the workspace
 * @param options - What to create
 * @returns Resolves when the library is written
 *
 * @example An internal library
 * ```bash
 * npx hf generate library my-lib --tags=type:util
 * ```
 *
 * @example A publishable library under a chosen directory
 * ```bash
 * npx hf generate library my-utils --directory=libs/utils --publishable --formats=esm,cjs,iife,umd
 * ```
 *
 * @example From a workspace's own generator, formatting once at the end
 * ```typescript
 * import libraryGenerator from '@hyperfrontend/workspace/generators/library'
 * import { formatFiles } from '@hyperfrontend/workspace/generators'
 *
 * await libraryGenerator(tree, { name: 'data-utils', tags: ['type:util'], skipFormat: true })
 * tree.write('libs/data-utils/src/index.ts', 'export * from "./data"\n')
 * await formatFiles(tree)
 * ```
 */
export async function libraryGenerator(tree: Tree, options: LibraryGeneratorOptions): Promise<void> {
  const plan = planLibrary(tree, options)
  generateFiles(tree, TEMPLATES, plan.projectRoot, { ...plan })
  writePackageJson(tree, plan)
  writeProjectJson(tree, plan)
  addTsConfigPath(tree, { packageName: plan.packageName, projectRoot: plan.projectRoot })
  if (options.publishable === true) {
    await runGenerator(tree, MAKE_PUBLISHABLE, {
      project: plan.projectName,
      ...(options.keywords === undefined ? {} : { keywords: options.keywords }),
      ...(options.formats === undefined ? {} : { formats: options.formats }),
      skipFormat: true,
    })
  }
  if (!options.skipFormat) await formatFiles(tree)
}

export default libraryGenerator
