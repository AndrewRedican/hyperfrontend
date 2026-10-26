import type { Tree } from '../../../lib/tree/tree'
import type { NormalizedOptions } from './move-helpers'
import { joinPathFragments } from '../../../lib/tree/paths'
import { updateJson } from '../../../lib/tree/tree'

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
 * Update lint.config.ts with the correct base config path.
 *
 * @param tree - The virtual file system tree
 * @param options - Normalized move generator options
 */
export function updateEslintConfig(tree: Tree, options: NormalizedOptions): void {
  const eslintConfigPath = joinPathFragments(options.newProjectRoot, 'lint.config.ts')

  if (!tree.exists(eslintConfigPath)) {
    return
  }

  let content = tree.read(eslintConfigPath, 'utf-8')
  if (content) {
    content = content.replace(/from ['"](?:\.\.\/)+lint\.base\.config\.ts['"]/g, `from '${options.newOffsetFromRoot}lint.base.config.ts'`)
    tree.write(eslintConfigPath, content)
  }
}

/**
 * Update tsconfig.json with new extends path.
 *
 * @param tree - The virtual file system tree
 * @param options - Normalized move generator options
 */
export function updateTsConfigJson(tree: Tree, options: NormalizedOptions): void {
  const tsconfigPath = joinPathFragments(options.newProjectRoot, 'tsconfig.json')

  if (!tree.exists(tsconfigPath)) {
    return
  }

  updateJson<ExtendingTsConfig>(tree, tsconfigPath, (json) => {
    if (json.extends && typeof json.extends === 'string') {
      json.extends = `${options.newOffsetFromRoot}tsconfig.base.json`
    }
    return json
  })
}

/**
 * Update a tsconfig file's outDir path.
 *
 * @param tree - The virtual file system tree
 * @param configPath - Full path to the tsconfig file
 * @param newOffsetFromRoot - Offset path to workspace root
 */
function updateTsConfigOutDir(tree: Tree, configPath: string, newOffsetFromRoot: string): void {
  if (!tree.exists(configPath)) {
    return
  }

  updateJson<OutDirTsConfig>(tree, configPath, (json) => {
    if (json.compilerOptions?.outDir) {
      json.compilerOptions.outDir = `${newOffsetFromRoot}dist/out-tsc`
    }
    return json
  })
}

/**
 * Update tsconfig.lib.json with new outDir path.
 *
 * @param tree - The virtual file system tree
 * @param options - Normalized move generator options
 */
export function updateTsConfigLibJson(tree: Tree, options: NormalizedOptions): void {
  updateTsConfigOutDir(tree, joinPathFragments(options.newProjectRoot, 'tsconfig.lib.json'), options.newOffsetFromRoot)
}

/**
 * Update tsconfig.spec.json with new outDir path.
 *
 * @param tree - The virtual file system tree
 * @param options - Normalized move generator options
 */
export function updateTsConfigSpecJson(tree: Tree, options: NormalizedOptions): void {
  updateTsConfigOutDir(tree, joinPathFragments(options.newProjectRoot, 'tsconfig.spec.json'), options.newOffsetFromRoot)
}
