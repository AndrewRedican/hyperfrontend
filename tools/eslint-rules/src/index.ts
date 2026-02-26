import type { ESLint, Rule } from 'eslint'
import noUnwantedBarrelFiles, { RULE_NAME as NO_UNWARRANTED_BARREL_FILES } from './rules/no-unwanted-barrel-files'

/**
 * Custom ESLint rules for the hyperfrontend monorepo.
 * Exported as a named export for \@nx/eslint-plugin workspace rules resolution.
 */
export const rules: ESLint.Plugin['rules'] = {
  [NO_UNWARRANTED_BARREL_FILES]: <Rule.RuleModule>(<unknown>noUnwantedBarrelFiles),
}
