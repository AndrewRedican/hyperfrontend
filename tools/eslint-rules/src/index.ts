import type { ESLint, Rule } from 'eslint'
import assertiveTestNames, { RULE_NAME as ASSERTIVE_TEST_NAMES } from './rules/assertive-test-names'
import deepestImportPath, { RULE_NAME as DEEPEST_IMPORT_PATH } from './rules/deepest-import-path'
import docsSiteLibraries, { RULE_NAME as DOCS_SITE_LIBRARIES } from './rules/docs-site-libraries'
import docsSiteLibraryDocs, { RULE_NAME as DOCS_SITE_LIBRARY_DOCS } from './rules/docs-site-library-docs'
import docsSiteRoutes, { RULE_NAME as DOCS_SITE_ROUTES } from './rules/docs-site-routes'
import docsSiteSecondaryEntries, { RULE_NAME as DOCS_SITE_SECONDARY_ENTRIES } from './rules/docs-site-secondary-entries'
import exportOrder, { RULE_NAME as EXPORT_ORDER } from './rules/export-order'
import importOrder, { RULE_NAME as IMPORT_ORDER } from './rules/import-order'
import jestMockAfterImports, { RULE_NAME as JEST_MOCK_AFTER_IMPORTS } from './rules/jest-mock-after-imports'
import libBuilderImplicitDependency, { RULE_NAME as LIB_BUILDER_IMPLICIT_DEPENDENCY } from './rules/lib-builder-implicit-dependency'
import libCiWorkflows, { RULE_NAME as LIB_CI_WORKFLOWS } from './rules/lib-ci-workflows'
import libCompatibilityDocs, { RULE_NAME as LIB_COMPATIBILITY_DOCS } from './rules/lib-compatibility-docs'
import libE2eProjectRequired, { RULE_NAME as LIB_E2E_PROJECT_REQUIRED } from './rules/lib-e2e-project-required'
import libEntryExportSpacing, { RULE_NAME as LIB_ENTRY_EXPORT_SPACING } from './rules/lib-entry-export-spacing'
import libPkgBundleEntry, { RULE_NAME as LIB_PKG_BUNDLE_ENTRY } from './rules/lib-pkg-bundle-entry'
import libPkgExportsExist, { RULE_NAME as LIB_PKG_EXPORTS_EXIST } from './rules/lib-pkg-exports-exist'
import libPkgExportsJsOnly, { RULE_NAME as LIB_PKG_EXPORTS_JS_ONLY } from './rules/lib-pkg-exports-js-only'
import libPkgFields, { RULE_NAME as LIB_PKG_FIELDS } from './rules/lib-pkg-fields'
import libPkgMainReexports, { RULE_NAME as LIB_PKG_MAIN_REEXPORTS } from './rules/lib-pkg-main-reexports'
import libPkgNoMain, { RULE_NAME as LIB_PKG_NO_MAIN } from './rules/lib-pkg-no-main'
import libPkgPackageJsonExport, { RULE_NAME as LIB_PKG_PACKAGE_JSON_EXPORT } from './rules/lib-pkg-package-json-export'
import libPkgSecondaryEntryReadme, { RULE_NAME as LIB_PKG_SECONDARY_ENTRY_README } from './rules/lib-pkg-secondary-entry-readme'
import libProjectBundleConfig, { RULE_NAME as LIB_PROJECT_BUNDLE_CONFIG } from './rules/lib-project-bundle-config'
import libProjectMetadata, { RULE_NAME as LIB_PROJECT_METADATA } from './rules/lib-project-metadata'
import libProjectVersionTargets, { RULE_NAME as LIB_PROJECT_VERSION_TARGETS } from './rules/lib-project-version-targets'
import libReadmeStructure, { RULE_NAME as LIB_README_STRUCTURE } from './rules/lib-readme-structure'
import libRequireJsdocExample, { RULE_NAME as LIB_REQUIRE_JSDOC_EXAMPLE } from './rules/lib-require-jsdoc-example'
import libRequireJsdocExampleLabel, { RULE_NAME as LIB_REQUIRE_JSDOC_EXAMPLE_LABEL } from './rules/lib-require-jsdoc-example-label'
import libRequireModuleHeader, { RULE_NAME as LIB_REQUIRE_MODULE_HEADER } from './rules/lib-require-module-header'
import libTsconfigPaths, { RULE_NAME as LIB_TSCONFIG_PATHS } from './rules/lib-tsconfig-paths'
import maxFileLines, { RULE_NAME as MAX_FILE_LINES } from './rules/max-file-lines'
import maxPathOccurrences, { RULE_NAME as MAX_PATH_OCCURRENCES } from './rules/max-path-occurrences'
import noAsciiArtDiagrams, { RULE_NAME as NO_ASCII_ART_DIAGRAMS } from './rules/no-ascii-art-diagrams'
import noAsyncFsApi, { RULE_NAME as NO_ASYNC_FS_API } from './rules/no-async-fs-api'
import noBarrelStarExport, { RULE_NAME as NO_BARREL_STAR_EXPORT } from './rules/no-barrel-star-export'
import noDecorativeHeaderComments, { RULE_NAME as NO_DECORATIVE_HEADER_COMMENTS } from './rules/no-decorative-header-comments'
import noDeprecatedTag, { RULE_NAME as NO_DEPRECATED_TAG } from './rules/no-deprecated-tag'
import noDirectConsole, { RULE_NAME as NO_DIRECT_CONSOLE } from './rules/no-direct-console'
import noEnum, { RULE_NAME as NO_ENUM } from './rules/no-enum'
import noInlineTypeLiteral, { RULE_NAME as NO_INLINE_TYPE_LITERAL } from './rules/no-inline-type-literal'
import noMixedTypeExport, { RULE_NAME as NO_MIXED_TYPE_EXPORT } from './rules/no-mixed-type-export'
import noMixedTypeImport, { RULE_NAME as NO_MIXED_TYPE_IMPORT } from './rules/no-mixed-type-import'
import noNamespaceImport, { RULE_NAME as NO_NAMESPACE_IMPORT } from './rules/no-namespace-import'
import noPlainInlineComments, { RULE_NAME as NO_PLAIN_INLINE_COMMENTS } from './rules/no-plain-inline-comments'
import noSectionDividers, { RULE_NAME as NO_SECTION_DIVIDERS } from './rules/no-section-dividers'
import noTodoComments, { RULE_NAME as NO_TODO_COMMENTS } from './rules/no-todo-comments'
import noUnsafeBuiltinMethods, { RULE_NAME as NO_UNSAFE_BUILTIN_METHODS } from './rules/no-unsafe-builtin-methods'
import noUnsafeRegex, { RULE_NAME as NO_UNSAFE_REGEX } from './rules/no-unsafe-regex'
import noUnwantedBarrelFiles, { RULE_NAME as NO_UNWARRANTED_BARREL_FILES } from './rules/no-unwanted-barrel-files'
import preferAngleBracketAssertion, { RULE_NAME as PREFER_ANGLE_BRACKET_ASSERTION } from './rules/prefer-angle-bracket-assertion'
import preferExecFileSync, { RULE_NAME as PREFER_EXEC_FILE_SYNC } from './rules/prefer-exec-file-sync'
import preferInlineSingleUse, { RULE_NAME as PREFER_INLINE_SINGLE_USE } from './rules/prefer-inline-single-use'
import preferJsDocOverTrailingComments, {
  RULE_NAME as PREFER_JSDOC_OVER_TRAILING_COMMENTS,
} from './rules/prefer-jsdoc-over-trailing-comments'
import requireCodeblockLanguage, { RULE_NAME as REQUIRE_CODEBLOCK_LANGUAGE } from './rules/require-codeblock-language'
import requireNodeProtocol, { RULE_NAME as REQUIRE_NODE_PROTOCOL } from './rules/require-node-protocol'
import rootReadmePackages, { RULE_NAME as ROOT_README_PACKAGES } from './rules/root-readme-packages'

/**
 * Custom ESLint rules for the hyperfrontend monorepo.
 * Exported as a named export for \@nx/eslint-plugin workspace rules resolution.
 */
export const rules: ESLint.Plugin['rules'] = {
  [ASSERTIVE_TEST_NAMES]: assertiveTestNames as unknown as Rule.RuleModule,
  [DEEPEST_IMPORT_PATH]: deepestImportPath as unknown as Rule.RuleModule,
  [DOCS_SITE_LIBRARIES]: docsSiteLibraries as unknown as Rule.RuleModule,
  [DOCS_SITE_LIBRARY_DOCS]: docsSiteLibraryDocs as unknown as Rule.RuleModule,
  [DOCS_SITE_ROUTES]: docsSiteRoutes as unknown as Rule.RuleModule,
  [DOCS_SITE_SECONDARY_ENTRIES]: docsSiteSecondaryEntries as unknown as Rule.RuleModule,
  [EXPORT_ORDER]: exportOrder as unknown as Rule.RuleModule,
  [LIB_COMPATIBILITY_DOCS]: libCompatibilityDocs as unknown as Rule.RuleModule,
  [LIB_ENTRY_EXPORT_SPACING]: libEntryExportSpacing as unknown as Rule.RuleModule,
  [IMPORT_ORDER]: importOrder as unknown as Rule.RuleModule,
  [JEST_MOCK_AFTER_IMPORTS]: jestMockAfterImports as unknown as Rule.RuleModule,
  [LIB_BUILDER_IMPLICIT_DEPENDENCY]: libBuilderImplicitDependency as unknown as Rule.RuleModule,
  [LIB_CI_WORKFLOWS]: libCiWorkflows as unknown as Rule.RuleModule,
  [LIB_E2E_PROJECT_REQUIRED]: libE2eProjectRequired as unknown as Rule.RuleModule,
  [LIB_PKG_BUNDLE_ENTRY]: libPkgBundleEntry as unknown as Rule.RuleModule,
  [LIB_PKG_EXPORTS_EXIST]: libPkgExportsExist as unknown as Rule.RuleModule,
  [LIB_PKG_EXPORTS_JS_ONLY]: libPkgExportsJsOnly as unknown as Rule.RuleModule,
  [LIB_PKG_FIELDS]: libPkgFields as unknown as Rule.RuleModule,
  [LIB_PKG_MAIN_REEXPORTS]: libPkgMainReexports as unknown as Rule.RuleModule,
  [LIB_PKG_NO_MAIN]: libPkgNoMain as unknown as Rule.RuleModule,
  [LIB_PKG_PACKAGE_JSON_EXPORT]: libPkgPackageJsonExport as unknown as Rule.RuleModule,
  [LIB_PKG_SECONDARY_ENTRY_README]: libPkgSecondaryEntryReadme as unknown as Rule.RuleModule,
  [LIB_PROJECT_BUNDLE_CONFIG]: libProjectBundleConfig as unknown as Rule.RuleModule,
  [LIB_PROJECT_METADATA]: libProjectMetadata as unknown as Rule.RuleModule,
  [LIB_PROJECT_VERSION_TARGETS]: libProjectVersionTargets as unknown as Rule.RuleModule,
  [LIB_README_STRUCTURE]: libReadmeStructure as unknown as Rule.RuleModule,
  [LIB_REQUIRE_JSDOC_EXAMPLE]: libRequireJsdocExample as unknown as Rule.RuleModule,
  [LIB_REQUIRE_JSDOC_EXAMPLE_LABEL]: libRequireJsdocExampleLabel as unknown as Rule.RuleModule,
  [LIB_REQUIRE_MODULE_HEADER]: libRequireModuleHeader as unknown as Rule.RuleModule,
  [LIB_TSCONFIG_PATHS]: libTsconfigPaths as unknown as Rule.RuleModule,
  [MAX_FILE_LINES]: maxFileLines as unknown as Rule.RuleModule,
  [MAX_PATH_OCCURRENCES]: maxPathOccurrences as unknown as Rule.RuleModule,
  [NO_ASCII_ART_DIAGRAMS]: noAsciiArtDiagrams as unknown as Rule.RuleModule,
  [NO_ASYNC_FS_API]: noAsyncFsApi as unknown as Rule.RuleModule,
  [NO_BARREL_STAR_EXPORT]: noBarrelStarExport as unknown as Rule.RuleModule,
  [NO_DECORATIVE_HEADER_COMMENTS]: noDecorativeHeaderComments as unknown as Rule.RuleModule,
  [NO_DEPRECATED_TAG]: noDeprecatedTag as unknown as Rule.RuleModule,
  [NO_DIRECT_CONSOLE]: noDirectConsole as unknown as Rule.RuleModule,
  [NO_ENUM]: noEnum as unknown as Rule.RuleModule,
  [NO_INLINE_TYPE_LITERAL]: noInlineTypeLiteral as unknown as Rule.RuleModule,
  [NO_MIXED_TYPE_EXPORT]: noMixedTypeExport as unknown as Rule.RuleModule,
  [NO_MIXED_TYPE_IMPORT]: noMixedTypeImport as unknown as Rule.RuleModule,
  [NO_NAMESPACE_IMPORT]: noNamespaceImport as unknown as Rule.RuleModule,
  [NO_PLAIN_INLINE_COMMENTS]: noPlainInlineComments as unknown as Rule.RuleModule,
  [NO_SECTION_DIVIDERS]: noSectionDividers as unknown as Rule.RuleModule,
  [NO_TODO_COMMENTS]: noTodoComments as unknown as Rule.RuleModule,
  [NO_UNSAFE_REGEX]: noUnsafeRegex as unknown as Rule.RuleModule,
  [NO_UNWARRANTED_BARREL_FILES]: noUnwantedBarrelFiles as unknown as Rule.RuleModule,
  [NO_UNSAFE_BUILTIN_METHODS]: noUnsafeBuiltinMethods as unknown as Rule.RuleModule,
  [PREFER_ANGLE_BRACKET_ASSERTION]: preferAngleBracketAssertion as unknown as Rule.RuleModule,
  [PREFER_EXEC_FILE_SYNC]: preferExecFileSync as unknown as Rule.RuleModule,
  [PREFER_INLINE_SINGLE_USE]: preferInlineSingleUse as unknown as Rule.RuleModule,
  [PREFER_JSDOC_OVER_TRAILING_COMMENTS]: preferJsDocOverTrailingComments as unknown as Rule.RuleModule,
  [REQUIRE_CODEBLOCK_LANGUAGE]: requireCodeblockLanguage as unknown as Rule.RuleModule,
  [REQUIRE_NODE_PROTOCOL]: requireNodeProtocol as unknown as Rule.RuleModule,
  [ROOT_README_PACKAGES]: rootReadmePackages as unknown as Rule.RuleModule,
}
