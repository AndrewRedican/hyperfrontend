import type { ESLint, Rule } from 'eslint'
import importOrder, { RULE_NAME as IMPORT_ORDER } from './rules/import-order'
import noMixedTypeImport, { RULE_NAME as NO_MIXED_TYPE_IMPORT } from './rules/no-mixed-type-import'
import noNamespaceImport, { RULE_NAME as NO_NAMESPACE_IMPORT } from './rules/no-namespace-import'
import noUnsafeBuiltinMethods, { RULE_NAME as NO_UNSAFE_BUILTIN_METHODS } from './rules/no-unsafe-builtin-methods'
import noUnwantedBarrelFiles, { RULE_NAME as NO_UNWARRANTED_BARREL_FILES } from './rules/no-unwanted-barrel-files'
import requireNodeProtocol, { RULE_NAME as REQUIRE_NODE_PROTOCOL } from './rules/require-node-protocol'

/**
 * Custom ESLint rules for the hyperfrontend monorepo.
 * Exported as a named export for \@nx/eslint-plugin workspace rules resolution.
 */
export const rules: ESLint.Plugin['rules'] = {
  [IMPORT_ORDER]: <Rule.RuleModule>(<unknown>importOrder),
  [NO_MIXED_TYPE_IMPORT]: <Rule.RuleModule>(<unknown>noMixedTypeImport),
  [NO_NAMESPACE_IMPORT]: <Rule.RuleModule>(<unknown>noNamespaceImport),
  [NO_UNWARRANTED_BARREL_FILES]: <Rule.RuleModule>(<unknown>noUnwantedBarrelFiles),
  [NO_UNSAFE_BUILTIN_METHODS]: <Rule.RuleModule>(<unknown>noUnsafeBuiltinMethods),
  [REQUIRE_NODE_PROTOCOL]: <Rule.RuleModule>(<unknown>requireNodeProtocol),
}
