export type { SectionDividerBlock } from './comment-analysis'
export type { ImportCategoryType } from './import-analysis'
export type { ScopedLogger, ScopedLoggerOptions } from './logger'
export type { PackageJson, ProjectJson, PublishableLibrary } from './nx-project'
export {
  JSDOC_TAGS,
  TOOLING_DIRECTIVE_PATTERNS,
  ALLOWED_HINT_PREFIXES,
  containsJsDocTag,
  isToolingDirective,
  hasAllowedHintPrefix,
  containsSectionDivider,
  isDecorativeHeaderComment,
  getLineCommentContent,
  isTrailingComment,
  findSectionDividerBlocks,
  isConfigFile,
} from './comment-analysis'
export { exists, isDirectory, readDirectory, readFileContent, readFileIfExists, readJsonFile, readJsonFileIfExists } from './fs'
export { ImportCategory, getImportCategory, getRelativeDepth, compareImportSources } from './import-analysis'
export { createNxScopedLogger, createRuleLogger, logger } from './logger'
export { NODE_BUILTIN_MODULES, isNodeBuiltinWithoutPrefix, addNodePrefix } from './node-builtins'
export {
  findLibraryDirectories,
  findPublishableLibraryDirectories,
  getAllPublishableLibraries,
  isPublishableLibrary,
  isPublishableLibraryDir,
  isPublishableProjectJson,
  looksLikeLibraryDir,
  readPackageJson,
  readProjectJson,
} from './nx-project'
export {
  findNxWorkspaceRoot,
  findProjectRoot,
  findRootDirectory,
  findTypeScriptWorkspaceRoot,
  findUpwardWhere,
  findWorkspaceRoot,
  findWorkspaceRootByMarker,
  isWithinWorkspace,
} from './workspace'
