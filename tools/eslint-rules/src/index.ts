import type { ESLint, Rule } from 'eslint'
import assertiveTestNames, { RULE_NAME as ASSERTIVE_TEST_NAMES } from './rules/assertive-test-names'
import importOrder, { RULE_NAME as IMPORT_ORDER } from './rules/import-order'
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
  [NO_ENUM]: <Rule.RuleModule>(<unknown>noEnum),
  [NO_MIXED_TYPE_IMPORT]: <Rule.RuleModule>(<unknown>noMixedTypeImport),
  [NO_NAMESPACE_IMPORT]: <Rule.RuleModule>(<unknown>noNamespaceImport),
  [NO_UNWARRANTED_BARREL_FILES]: <Rule.RuleModule>(<unknown>noUnwantedBarrelFiles),
  [NO_UNSAFE_BUILTIN_METHODS]: <Rule.RuleModule>(<unknown>noUnsafeBuiltinMethods),
  [PREFER_ANGLE_BRACKET_ASSERTION]: <Rule.RuleModule>(<unknown>preferAngleBracketAssertion),
  [REQUIRE_NODE_PROTOCOL]: <Rule.RuleModule>(<unknown>requireNodeProtocol),
}
