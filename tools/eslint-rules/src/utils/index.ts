export type { ScopedLogger, ScopedLoggerOptions } from './logger'
export type { PackageJson, ProjectJson, PublishableLibrary } from './nx-project'
export { createNxScopedLogger, createRuleLogger, logger } from './logger'
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
export { exists, isDirectory, readDirectory, readFileContent, readFileIfExists, readJsonFile, readJsonFileIfExists } from './fs'
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
export { ImportCategory, getImportCategory, getRelativeDepth, compareImportSources } from './import-analysis'
export type { ImportCategoryType } from './import-analysis'
export { NODE_BUILTIN_MODULES, isNodeBuiltinWithoutPrefix, addNodePrefix } from './node-builtins'
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
export type { SectionDividerBlock } from './comment-analysis'
