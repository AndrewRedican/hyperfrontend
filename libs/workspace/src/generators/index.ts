/**
 * What the generators are built from, so a workspace's own generators compose the packaged ones
 * on the same tree: JSON, project and template helpers, names and paths, and running by name.
 *
 * @module @hyperfrontend/workspace/generators
 */

export type { Generator, Tree, TreeChange } from '../runner/contract'
export type { UpdateContentOptions } from './shared/content-updaters'
export type { Prettier } from './shared/format'
export type { JsonWithDescription, NamedJson } from './shared/json-updaters'
export type { BlockBounds, TextLines } from './shared/lines'
export type { Names } from './shared/names'
export type { Funding, PackageJsonInfo, Repository, RootManifest } from './shared/package-json'
export type { UpdateReferencesOptions } from './shared/project-references'
export type { ProjectConfiguration } from './shared/projects'
export type { Substitutions } from './shared/templates'
export type { AddPathOptions, MovePathOptions, RenamePathOptions } from './shared/tsconfig-paths'
export type { IgnoreRule } from './shared/walk'
export { runGenerator } from '../runner/generators'
export { updateContentReferences, updateModuleJSDoc, updateReadmeReferences } from './shared/content-updaters'
export { formatFiles, prettierOf } from './shared/format'
export { replaceDescriptionPackageName } from './shared/json-updaters'
export { PRINT_WIDTH, blockBounds, findLine, indentOf, joinLines, quote, splitLines } from './shared/lines'
export { names } from './shared/names'
export { DEFAULT_NODE_ENGINE, DEFAULT_NPM_ENGINE, compactVersion, nodeFloorOf } from './shared/node-floor'
export { getPackageNameFromProject, readPackageJsonInfo, readRootManifest } from './shared/package-json'
export { joinPathFragments, offsetFromRoot } from './shared/paths'
export { updateProjectReferences } from './shared/project-references'
export { getProjects, readProjectConfiguration } from './shared/projects'
export { globalNameOf, scopeOf, scopedName, unscopedName } from './shared/scope'
export { generateFiles, renderExpression, renderTemplate } from './shared/templates'
export { readJson, updateJson, writeJson } from './shared/tree'
export { addTsConfigPath, moveTsConfigPaths, renameTsConfigPaths, sortPaths } from './shared/tsconfig-paths'
export { compileIgnoreRules, isIgnored, visitNotIgnoredFiles } from './shared/walk'
