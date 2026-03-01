import type { ESLint, Rule } from 'eslint'
import assertiveTestNames, { RULE_NAME as ASSERTIVE_TEST_NAMES } from './rules/assertive-test-names'
import importOrder, { RULE_NAME as IMPORT_ORDER } from './rules/import-order'
import libPkgBundleEntry, { RULE_NAME as LIB_PKG_BUNDLE_ENTRY } from './rules/lib-pkg-bundle-entry'
import libPkgExportsExist, { RULE_NAME as LIB_PKG_EXPORTS_EXIST } from './rules/lib-pkg-exports-exist'
import libPkgExportsJsOnly, { RULE_NAME as LIB_PKG_EXPORTS_JS_ONLY } from './rules/lib-pkg-exports-js-only'
import libPkgFields, { RULE_NAME as LIB_PKG_FIELDS } from './rules/lib-pkg-fields'
import libPkgNoMain, { RULE_NAME as LIB_PKG_NO_MAIN } from './rules/lib-pkg-no-main'
import libPkgPackageJsonExport, { RULE_NAME as LIB_PKG_PACKAGE_JSON_EXPORT } from './rules/lib-pkg-package-json-export'
import libProjectBundleConfig, { RULE_NAME as LIB_PROJECT_BUNDLE_CONFIG } from './rules/lib-project-bundle-config'
import libProjectMetadata, { RULE_NAME as LIB_PROJECT_METADATA } from './rules/lib-project-metadata'
import noEnum, { RULE_NAME as NO_ENUM } from './rules/no-enum'
import noMixedTypeImport, { RULE_NAME as NO_MIXED_TYPE_IMPORT } from './rules/no-mixed-type-import'
import noNamespaceImport, { RULE_NAME as NO_NAMESPACE_IMPORT } from './rules/no-namespace-import'
import noUnsafeBuiltinMethods, { RULE_NAME as NO_UNSAFE_BUILTIN_METHODS } from './rules/no-unsafe-builtin-methods'
import noUnwantedBarrelFiles, { RULE_NAME as NO_UNWARRANTED_BARREL_FILES } from './rules/no-unwanted-barrel-files'
import preferAngleBracketAssertion, { RULE_NAME as PREFER_ANGLE_BRACKET_ASSERTION } from './rules/prefer-angle-bracket-assertion'
import requireNodeProtocol, { RULE_NAME as REQUIRE_NODE_PROTOCOL } from './rules/require-node-protocol'

/**
 * Custom ESLint rules for the hyperfrontend monorepo.
 * Exported as a named export for \@nx/eslint-plugin workspace rules resolution.
 */
export const rules: ESLint.Plugin['rules'] = {
  [ASSERTIVE_TEST_NAMES]: <Rule.RuleModule>(<unknown>assertiveTestNames),
  [IMPORT_ORDER]: <Rule.RuleModule>(<unknown>importOrder),
  [LIB_PKG_BUNDLE_ENTRY]: <Rule.RuleModule>(<unknown>libPkgBundleEntry),
  [LIB_PKG_EXPORTS_EXIST]: <Rule.RuleModule>(<unknown>libPkgExportsExist),
  [LIB_PKG_EXPORTS_JS_ONLY]: <Rule.RuleModule>(<unknown>libPkgExportsJsOnly),
  [LIB_PKG_FIELDS]: <Rule.RuleModule>(<unknown>libPkgFields),
  [LIB_PKG_NO_MAIN]: <Rule.RuleModule>(<unknown>libPkgNoMain),
  [LIB_PKG_PACKAGE_JSON_EXPORT]: <Rule.RuleModule>(<unknown>libPkgPackageJsonExport),
  [LIB_PROJECT_BUNDLE_CONFIG]: <Rule.RuleModule>(<unknown>libProjectBundleConfig),
  [LIB_PROJECT_METADATA]: <Rule.RuleModule>(<unknown>libProjectMetadata),
  [NO_ENUM]: <Rule.RuleModule>(<unknown>noEnum),
  [NO_MIXED_TYPE_IMPORT]: <Rule.RuleModule>(<unknown>noMixedTypeImport),
  [NO_NAMESPACE_IMPORT]: <Rule.RuleModule>(<unknown>noNamespaceImport),
  [NO_UNWARRANTED_BARREL_FILES]: <Rule.RuleModule>(<unknown>noUnwantedBarrelFiles),
  [NO_UNSAFE_BUILTIN_METHODS]: <Rule.RuleModule>(<unknown>noUnsafeBuiltinMethods),
  [PREFER_ANGLE_BRACKET_ASSERTION]: <Rule.RuleModule>(<unknown>preferAngleBracketAssertion),
  [REQUIRE_NODE_PROTOCOL]: <Rule.RuleModule>(<unknown>requireNodeProtocol),
}
