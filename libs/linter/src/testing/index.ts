/**
 * Specifying a rule: valid texts that must report nothing and invalid texts with the messages,
 * positions and fixed text they must produce, each case one `node:test` test.
 *
 * @module @hyperfrontend/linter/testing
 */

export type { ExpectedError, InvalidCase, RuleCase, RuleCases } from './rule-tester'
export { testRule } from './rule-tester'
