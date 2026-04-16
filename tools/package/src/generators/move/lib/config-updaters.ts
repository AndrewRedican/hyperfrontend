import type { Tree } from '@nx/devkit'
import type { NormalizedOptions } from './move-helpers'
import { joinPathFragments, updateJson } from '@nx/devkit'

/**
 * Update eslint.config.cjs with the correct base config path.
 *
 * @param tree - The virtual file system tree
 * @param options - Normalized move generator options
 */
export function updateEslintConfig(tree: Tree, options: NormalizedOptions): void {
  const eslintConfigPath = joinPathFragments(options.newProjectRoot, 'eslint.config.cjs')

  if (!tree.exists(eslintConfigPath)) {
    return
  }

  let content = tree.read(eslintConfigPath, 'utf-8')
  if (content) {
    content = content.replace(
      /require\(['"](?:\.\.\/)+eslint\.base\.config\.cjs['"]\)/g,
      `require('${options.newOffsetFromRoot}eslint.base.config.cjs')`
    )
    tree.write(eslintConfigPath, content)
  }
}

/**
 * Update jest.config.ts with new preset and coverage paths.
 *
 * @param tree - The virtual file system tree
 * @param options - Normalized move generator options
 */
export function updateJestConfig(tree: Tree, options: NormalizedOptions): void {
  const jestConfigPath = joinPathFragments(options.newProjectRoot, 'jest.config.ts')

  if (!tree.exists(jestConfigPath)) {
    return
  }

  let content = tree.read(jestConfigPath, 'utf-8')
  if (content) {
    content = content.replace(/preset:\s*['"](?:\.\.\/)+jest\.preset\.cjs['"]/g, `preset: '${options.newOffsetFromRoot}jest.preset.cjs'`)

    const newCoveragePath = options.newProjectRoot.replace(/^libs\/?/, 'libs/')
    content = content.replace(
      /coverageDirectory:\s*['"](?:\.\.\/)+coverage\/[^'"]+['"]/g,
      `coverageDirectory: '${options.newOffsetFromRoot}coverage/${newCoveragePath}'`
    )

    tree.write(jestConfigPath, content)
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

  updateJson(tree, tsconfigPath, (json) => {
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

  updateJson(tree, configPath, (json) => {
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
