import type { ESLint, Rule } from 'eslint'
import assertiveTestNames, { RULE_NAME as ASSERTIVE_TEST_NAMES } from './rules/assertive-test-names'
import docsSiteLibraries, { RULE_NAME as DOCS_SITE_LIBRARIES } from './rules/docs-site-libraries'
import importOrder, { RULE_NAME as IMPORT_ORDER } from './rules/import-order'
import libCiWorkflows, { RULE_NAME as LIB_CI_WORKFLOWS } from './rules/lib-ci-workflows'
import libE2eProjectRequired, { RULE_NAME as LIB_E2E_PROJECT_REQUIRED } from './rules/lib-e2e-project-required'
import libPkgBundleEntry, { RULE_NAME as LIB_PKG_BUNDLE_ENTRY } from './rules/lib-pkg-bundle-entry'
import libPkgExportsExist, { RULE_NAME as LIB_PKG_EXPORTS_EXIST } from './rules/lib-pkg-exports-exist'
import libPkgExportsJsOnly, { RULE_NAME as LIB_PKG_EXPORTS_JS_ONLY } from './rules/lib-pkg-exports-js-only'
import libPkgFields, { RULE_NAME as LIB_PKG_FIELDS } from './rules/lib-pkg-fields'
import libPkgNoMain, { RULE_NAME as LIB_PKG_NO_MAIN } from './rules/lib-pkg-no-main'
import libPkgPackageJsonExport, { RULE_NAME as LIB_PKG_PACKAGE_JSON_EXPORT } from './rules/lib-pkg-package-json-export'
import libProjectBundleConfig, { RULE_NAME as LIB_PROJECT_BUNDLE_CONFIG } from './rules/lib-project-bundle-config'
import libProjectMetadata, { RULE_NAME as LIB_PROJECT_METADATA } from './rules/lib-project-metadata'
import libReadmeStructure, { RULE_NAME as LIB_README_STRUCTURE } from './rules/lib-readme-structure'
import noAsyncFsApi, { RULE_NAME as NO_ASYNC_FS_API } from './rules/no-async-fs-api'
import noDeprecatedTag, { RULE_NAME as NO_DEPRECATED_TAG } from './rules/no-deprecated-tag'
import noEnum, { RULE_NAME as NO_ENUM } from './rules/no-enum'
import noMixedTypeImport, { RULE_NAME as NO_MIXED_TYPE_IMPORT } from './rules/no-mixed-type-import'
import noNamespaceImport, { RULE_NAME as NO_NAMESPACE_IMPORT } from './rules/no-namespace-import'
import noUnsafeBuiltinMethods, { RULE_NAME as NO_UNSAFE_BUILTIN_METHODS } from './rules/no-unsafe-builtin-methods'
import noUnsafeRegex, { RULE_NAME as NO_UNSAFE_REGEX } from './rules/no-unsafe-regex'
import noUnwantedBarrelFiles, { RULE_NAME as NO_UNWARRANTED_BARREL_FILES } from './rules/no-unwanted-barrel-files'
import preferAngleBracketAssertion, { RULE_NAME as PREFER_ANGLE_BRACKET_ASSERTION } from './rules/prefer-angle-bracket-assertion'
import requireNodeProtocol, { RULE_NAME as REQUIRE_NODE_PROTOCOL } from './rules/require-node-protocol'
import rootReadmePackages, { RULE_NAME as ROOT_README_PACKAGES } from './rules/root-readme-packages'

/**
 * Custom ESLint rules for the hyperfrontend monorepo.
 * Exported as a named export for \@nx/eslint-plugin workspace rules resolution.
 */
export const rules: ESLint.Plugin['rules'] = {
  [ASSERTIVE_TEST_NAMES]: assertiveTestNames as unknown as Rule.RuleModule,
  [DOCS_SITE_LIBRARIES]: docsSiteLibraries as unknown as Rule.RuleModule,
  [IMPORT_ORDER]: importOrder as unknown as Rule.RuleModule,
  [LIB_CI_WORKFLOWS]: libCiWorkflows as unknown as Rule.RuleModule,
  [LIB_E2E_PROJECT_REQUIRED]: libE2eProjectRequired as unknown as Rule.RuleModule,
  [LIB_PKG_BUNDLE_ENTRY]: libPkgBundleEntry as unknown as Rule.RuleModule,
  [LIB_PKG_EXPORTS_EXIST]: libPkgExportsExist as unknown as Rule.RuleModule,
  [LIB_PKG_EXPORTS_JS_ONLY]: libPkgExportsJsOnly as unknown as Rule.RuleModule,
  [LIB_PKG_FIELDS]: libPkgFields as unknown as Rule.RuleModule,
  [LIB_PKG_NO_MAIN]: libPkgNoMain as unknown as Rule.RuleModule,
  [LIB_PKG_PACKAGE_JSON_EXPORT]: libPkgPackageJsonExport as unknown as Rule.RuleModule,
  [LIB_PROJECT_BUNDLE_CONFIG]: libProjectBundleConfig as unknown as Rule.RuleModule,
  [LIB_PROJECT_METADATA]: libProjectMetadata as unknown as Rule.RuleModule,
  [LIB_README_STRUCTURE]: libReadmeStructure as unknown as Rule.RuleModule,
  [NO_ASYNC_FS_API]: noAsyncFsApi as unknown as Rule.RuleModule,
  [NO_DEPRECATED_TAG]: noDeprecatedTag as unknown as Rule.RuleModule,
  [NO_ENUM]: noEnum as unknown as Rule.RuleModule,
  [NO_MIXED_TYPE_IMPORT]: noMixedTypeImport as unknown as Rule.RuleModule,
  [NO_UNSAFE_REGEX]: noUnsafeRegex as unknown as Rule.RuleModule,
  [NO_NAMESPACE_IMPORT]: noNamespaceImport as unknown as Rule.RuleModule,
  [NO_UNWARRANTED_BARREL_FILES]: noUnwantedBarrelFiles as unknown as Rule.RuleModule,
  [NO_UNSAFE_BUILTIN_METHODS]: noUnsafeBuiltinMethods as unknown as Rule.RuleModule,
  [PREFER_ANGLE_BRACKET_ASSERTION]: preferAngleBracketAssertion as unknown as Rule.RuleModule,
  [REQUIRE_NODE_PROTOCOL]: requireNodeProtocol as unknown as Rule.RuleModule,
  [ROOT_README_PACKAGES]: rootReadmePackages as unknown as Rule.RuleModule,
}
