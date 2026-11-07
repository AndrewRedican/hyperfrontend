/**
 * The `make-publishable` generator: the targets, manifest fields, README and e2e project a
 * library of the workspace needs to be built, tested as a package and published.
 *
 * @module generators/make-publishable/generator
 */

import type { Tree } from '../../runner/contract'
import type { BundleFormat, MakePublishableGeneratorOptions } from './options'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { tarballStem } from '../../executors/version/lib/update-e2e-dependencies'
import { E2E_PREFIX } from '../shared/e2e-project'
import { formatFiles } from '../shared/format'
import { DEFAULT_NODE_ENGINE, DEFAULT_NPM_ENGINE } from '../shared/node-floor'
import { readPackageJsonInfo, readRootManifest } from '../shared/package-json'
import { joinPathFragments, offsetFromRoot } from '../shared/paths'
import { readProjectConfiguration } from '../shared/projects'
import { globalNameOf, scopeOf, scopedName, unscopedName } from '../shared/scope'
import { generateFiles } from '../shared/templates'
import { readJson, updateJson } from '../shared/tree'

/** The formats the build writes, in the order a target lists them. */
const FORMATS: readonly BundleFormat[] = ['esm', 'cjs', 'iife', 'umd']

/** The formats only a browser or a CDN consumer loads, which share the `browser` e2e suite. */
const BROWSER_FORMATS: readonly BundleFormat[] = ['iife', 'umd']

/** The executor of the `build` target when none is chosen. */
const DEFAULT_BUILD_EXECUTOR = '@hyperfrontend/workspace:build'

/** The directory the e2e project is created under when none is chosen. */
const DEFAULT_E2E_DIRECTORY = 'e2e'

// why: the CommonJS build of this module has no import.meta.dirname, and the ES module, which the specs load, has no __dirname
/* node:coverage ignore next 1 */
const TEMPLATES = typeof __dirname === 'string' ? __dirname : import.meta.dirname

/** A `build` target as far as the generator merges into it. */
interface BuildTarget {
  /** The executor, when the project chose one */
  executor?: string
  /** The options by format */
  options?: Record<string, unknown>
}

/** The parts of a `project.json` the generator rewrites. */
interface PublishableProjectJson {
  /** The targets, by name */
  targets?: Record<string, unknown>
}

/** The parts of a `package.json` the generator rewrites. */
interface PublishablePackageJson {
  /** Whether npm refuses to publish the package */
  private?: boolean
  /** The version */
  version?: string
  /** The licence identifier */
  license?: string
  /** Whether a bundler may drop unused modules */
  sideEffects?: boolean
  /** The runtimes the package declares */
  engines?: Record<string, string>
  /** The exports map */
  exports?: Record<string, unknown>
  /** The npm keywords */
  keywords?: string[]
  /** Where sponsorship goes */
  funding?: unknown
}

/** The options settled. */
export interface PublishablePlan {
  /** The project's name */
  projectName: string
  /** The project's directory, relative to the root */
  projectRoot: string
  /** The package's name */
  packageName: string
  /** The package's description */
  description: string
  /** The bundle formats */
  formats: readonly BundleFormat[]
  /** The global of the browser bundles */
  globalName: string
  /** The entry of the browser bundles */
  bundleEntry: string
  /** The npm keywords */
  keywords: string[]
  /** The Node.js range chosen, or undefined to keep the package's own or inherit the root's */
  nodeEngine: string | undefined
  /** The executor of the `build` target */
  buildExecutor: string
  /** The e2e project's name */
  e2eProjectName: string
  /** The e2e package's name */
  e2ePackageName: string
  /** The e2e project's directory, relative to the root */
  e2eProjectRoot: string
  /** Whether the e2e project is created */
  createE2e: boolean
  /** Whether the project already publishes, so what it has is kept */
  republishing: boolean
}

/**
 * The bundle formats as given, checked.
 *
 * @param formats - The formats as given, or undefined for the default
 * @returns The formats in the build's order
 * @throws {Error} When a format is not one the build writes
 */
function bundleFormats(formats: readonly string[] | undefined): BundleFormat[] {
  const chosen = formats ?? ['esm', 'cjs']
  const unknown = chosen.filter((format) => !(FORMATS as readonly string[]).includes(format))
  if (unknown.length > 0) throw createError(`unknown bundle formats ${unknown.join(', ')}; the build writes ${FORMATS.join(', ')}`)
  return FORMATS.filter((format) => chosen.includes(format))
}

/**
 * Settles the options: the project, its package, the formats and the e2e project's names.
 *
 * @param tree - The tree the project lives in
 * @param options - The options as given
 * @returns The names, the formats and the e2e project the generator writes from
 * @throws {Error} When the project has no `package.json` with a name, or a format is unknown
 */
export function planPublishable(tree: Tree, options: MakePublishableGeneratorOptions): PublishablePlan {
  const project = readProjectConfiguration(tree, options.project)
  const manifest = readPackageJsonInfo(tree, project.root)
  if (manifest.name === null) throw createError(`${options.project} has no package.json naming its package, so it cannot be published`)
  const packageName = manifest.name
  const name = unscopedName(packageName)
  const scope = scopeOf(packageName)
  const formats = bundleFormats(options.formats)
  return {
    projectName: options.project,
    projectRoot: project.root,
    packageName,
    description: manifest.description,
    formats,
    globalName: options.globalName ?? globalNameOf(packageName),
    bundleEntry: options.bundleEntry ?? '.',
    // why: keywords a package already chose describe it better than a default can, so they are kept unless the run names its own
    keywords:
      options.keywords ??
      (manifest.keywords.length > 0 ? manifest.keywords : [name, ...(scope === undefined ? [] : [scope.slice(1)]), 'typescript']),
    nodeEngine: options.nodeEngine,
    buildExecutor: options.buildExecutor ?? DEFAULT_BUILD_EXECUTOR,
    e2eProjectName: `${E2E_PREFIX}${options.project}`,
    e2ePackageName: scopedName(scope, `${E2E_PREFIX}${name}`),
    e2eProjectRoot: joinPathFragments(options.e2eDirectory ?? DEFAULT_E2E_DIRECTORY, name),
    createE2e: options.skipE2E !== true,
    republishing: project.targets?.['publish'] !== undefined,
  }
}

/**
 * The options of the `build` target: each format chosen, the browser ones with their entry
 * and global.
 *
 * @param plan - The settled options
 * @returns The build options, one entry per format
 */
function buildOptions(plan: PublishablePlan): Record<string, Record<string, unknown>> {
  const options: Record<string, Record<string, unknown>> = {}
  for (const format of plan.formats) {
    options[format] = BROWSER_FORMATS.includes(format)
      ? { entry: plan.bundleEntry, globalName: plan.globalName }
      : { bundleWorkspaceDeps: true }
  }
  return options
}

/**
 * The `build` target with the formats chosen merged into the one the project has: the
 * project's executor and its options for a format win, so a re-run changes nothing, and the
 * formats a library was created with gain what a published package needs.
 *
 * @param plan - The settled options
 * @param existing - The project's `build` target, or nothing
 * @returns The target with the executor settled and every chosen format configured
 */
function mergedBuildTarget(plan: PublishablePlan, existing: BuildTarget): BuildTarget {
  const options: Record<string, unknown> = { ...existing.options }
  for (const [format, defaults] of entries(buildOptions(plan))) {
    const configured = options[format]
    options[format] = typeof configured === 'object' && configured !== null ? { ...defaults, ...configured } : defaults
  }
  return { ...existing, executor: existing.executor ?? plan.buildExecutor, options }
}

/**
 * Adds the targets a published package runs to `project.json`: `version`, `version-check`,
 * `build` with the formats, `publish` and `typecheck`. A target the project already configures
 * keeps its configuration, the `build` target gaining the formats it lacks, so a re-run changes
 * nothing.
 *
 * @param tree - The tree written to
 * @param plan - The settled options
 */
function updateProjectJson(tree: Tree, plan: PublishablePlan): void {
  updateJson<PublishableProjectJson>(tree, joinPathFragments(plan.projectRoot, 'project.json'), (json) => {
    const targets: Record<string, unknown> = { version: {}, 'version-check': {}, build: {}, publish: {}, typecheck: {}, ...json.targets }
    targets['build'] = mergedBuildTarget(plan, (json.targets?.['build'] ?? {}) as BuildTarget)
    json.targets = targets
    return json
  })
}

/**
 * Makes `package.json` publishable: no longer private, with the licence and the funding the
 * package states or inherits from the root manifest, the engines it states or the defaults,
 * `sideEffects` off, the `package.json` export, and the keywords.
 *
 * @param tree - The tree written to
 * @param plan - The settled options
 */
function updatePackageJson(tree: Tree, plan: PublishablePlan): void {
  const root = readRootManifest(tree)
  updateJson<PublishablePackageJson>(tree, joinPathFragments(plan.projectRoot, 'package.json'), (json) => {
    delete json.private
    const license = json.license ?? root.license
    if (license !== undefined) json.license = license
    json.sideEffects = false
    const engines = json.engines ?? {}
    json.engines = {
      ...engines,
      node: engines['node'] ?? plan.nodeEngine ?? DEFAULT_NODE_ENGINE,
      npm: engines['npm'] ?? DEFAULT_NPM_ENGINE,
    }
    json.exports = { ...(json.exports ?? { '.': './src/index.js' }), './package.json': './package.json' }
    json.keywords = plan.keywords
    const funding = json.funding ?? root.funding
    if (funding !== undefined) json.funding = funding
    return json
  })
}

/**
 * Writes the e2e project: its manifests, the TypeScript configuration, and one suite per format
 * chosen; the suites of the formats not chosen are dropped. A project that already publishes
 * keeps every e2e file it has.
 *
 * @param tree - The tree written to
 * @param plan - The settled options
 */
function createE2eProject(tree: Tree, plan: PublishablePlan): void {
  const browser = plan.formats.some((format) => BROWSER_FORMATS.includes(format))
  // why: the suites run in the order the e2e executor names its built-in formats, the browser one last
  const e2eFormats = ['cjs', 'esm', 'browser'].filter((format) =>
    format === 'browser' ? browser : plan.formats.includes(format as BundleFormat)
  )
  const version = readJson<PublishablePackageJson>(tree, joinPathFragments(plan.projectRoot, 'package.json')).version ?? '0.0.0'
  const dropped = FORMATS.filter((format) => !plan.formats.includes(format)).map((format) =>
    joinPathFragments(plan.e2eProjectRoot, 'src', `${format}.spec.ts`)
  )
  const kept = dropped.filter((path) => plan.republishing && tree.exists(path))
  generateFiles(
    tree,
    join(TEMPLATES, 'files-e2e'),
    plan.e2eProjectRoot,
    {
      ...plan,
      version,
      tarballStem: tarballStem(plan.packageName),
      e2eFormats: stringify(e2eFormats),
      e2eOffsetFromRoot: offsetFromRoot(plan.e2eProjectRoot),
    },
    { keepExisting: plan.republishing }
  )
  for (const path of dropped) if (!kept.includes(path)) tree.delete(path)
}

/**
 * Makes a library publishable: the targets a package runs, the manifest fields a registry
 * asks for, a README when the project has none, and the project that tests the package.
 *
 * @param tree - The tree, rooted at the workspace
 * @param options - Which project, and how it is built and tested
 * @returns Resolves when the project is written
 * @throws {Error} When the project is unknown, has no named package, or names an unknown format
 *
 * @example A package in ESM and CommonJS
 * ```bash
 * npx hf generate make-publishable my-lib
 * ```
 *
 * @example A package with browser bundles under a chosen global
 * ```bash
 * npx hf generate make-publishable my-lib --formats=esm,cjs,iife,umd --globalName=MyLib
 * ```
 */
export async function makePublishableGenerator(tree: Tree, options: MakePublishableGeneratorOptions): Promise<void> {
  const plan = planPublishable(tree, options)
  updateProjectJson(tree, plan)
  updatePackageJson(tree, plan)
  generateFiles(tree, join(TEMPLATES, 'files'), plan.projectRoot, { ...plan }, { keepExisting: true })
  if (plan.createE2e) createE2eProject(tree, plan)
  if (!options.skipFormat) await formatFiles(tree)
}

export default makePublishableGenerator
