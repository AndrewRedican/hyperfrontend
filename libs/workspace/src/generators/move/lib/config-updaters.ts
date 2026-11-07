/* lint-disable workspace/lib-require-jsdoc-example */
/**
 * The paths a moved project's configuration files write back to the root: the base lint
 * configuration, the base tsconfig, and the output directories.
 *
 * @module generators/move/lib/config-updaters
 */

import type { Tree } from '../../../runner/contract'
import type { MovePlan } from './move-helpers'
import { joinPathFragments } from '../../shared/paths'
import { updateJson } from '../../shared/tree'

/** A tsconfig as far as its base goes. */
interface ExtendingTsConfig {
  /** The configuration extended, when it is one file */
  extends?: unknown
}

/** Compiler options as far as the output directory goes. */
interface OutDirOptions {
  /** Where compiled files go */
  outDir?: unknown
}

/** A tsconfig as far as its output directory goes. */
interface OutDirTsConfig {
  /** The compiler options */
  compilerOptions?: OutDirOptions
}

/**
 * Points the moved project's `lint.config.ts` at the base configuration from its new depth.
 *
 * @param tree - The tree the file lives in
 * @param plan - The settled move
 */
export function updateLintConfig(tree: Tree, plan: MovePlan): void {
  const lintConfigPath = joinPathFragments(plan.newProjectRoot, 'lint.config.ts')
  const content = tree.read(lintConfigPath, 'utf-8')
  if (content === null) return
  tree.write(
    lintConfigPath,
    content.replace(/from ['"](?:\.\.\/)+lint\.base\.config\.ts['"]/g, `from '${plan.newOffsetFromRoot}lint.base.config.ts'`)
  )
}

/**
 * Points the moved project's `tsconfig.json` at the base tsconfig from its new depth.
 *
 * @param tree - The tree the file lives in
 * @param plan - The settled move
 */
export function updateTsConfigJson(tree: Tree, plan: MovePlan): void {
  const tsconfigPath = joinPathFragments(plan.newProjectRoot, 'tsconfig.json')
  if (!tree.exists(tsconfigPath)) return
  updateJson<ExtendingTsConfig>(tree, tsconfigPath, (json) => {
    if (typeof json.extends === 'string') json.extends = `${plan.newOffsetFromRoot}tsconfig.base.json`
    return json
  })
}

/**
 * Points a tsconfig's `outDir` at the root's output directory from the new depth.
 *
 * @param tree - The tree the file lives in
 * @param configPath - The tsconfig, relative to the root
 * @param newOffsetFromRoot - The path from the new project root to the workspace root
 */
function updateTsConfigOutDir(tree: Tree, configPath: string, newOffsetFromRoot: string): void {
  if (!tree.exists(configPath)) return
  updateJson<OutDirTsConfig>(tree, configPath, (json) => {
    if (json.compilerOptions?.outDir !== undefined) json.compilerOptions.outDir = `${newOffsetFromRoot}dist/out-tsc`
    return json
  })
}

/**
 * Points the moved project's `tsconfig.lib.json` output directory at the root's from its new depth.
 *
 * @param tree - The tree the file lives in
 * @param plan - The settled move
 */
export function updateTsConfigLibJson(tree: Tree, plan: MovePlan): void {
  updateTsConfigOutDir(tree, joinPathFragments(plan.newProjectRoot, 'tsconfig.lib.json'), plan.newOffsetFromRoot)
}

/**
 * Points the moved project's `tsconfig.spec.json` output directory at the root's from its new depth.
 *
 * @param tree - The tree the file lives in
 * @param plan - The settled move
 */
export function updateTsConfigSpecJson(tree: Tree, plan: MovePlan): void {
  updateTsConfigOutDir(tree, joinPathFragments(plan.newProjectRoot, 'tsconfig.spec.json'), plan.newOffsetFromRoot)
}
