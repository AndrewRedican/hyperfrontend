/**
 * Rule sets to build a configuration from: the file kinds, and the core, TypeScript, JSDoc and
 * React rules that the upstream recommended configurations turn on, with this package's
 * adjustments.
 *
 * @module presets/rule-sets
 */

import type { RuleSetting } from '../config/model'
import { fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Rules turned on at one severity.
 *
 * @param ids - Rule ids separated by spaces or line breaks
 * @param severity - The severity every rule gets
 * @returns The rules by id
 *
 * @example Turn several rules on in one block
 * ```ts
 * import { on } from '@hyperfrontend/linter'
 *
 * export default [
 *   { files: ['src/**'], rules: on('no-var prefer-const typescript/no-namespace') },
 *   { files: ['src/**'], rules: on('no-todo-comments', 'warn') },
 * ]
 * ```
 */
export function on(ids: string, severity: 'warn' | 'error' = 'error'): Record<string, RuleSetting> {
  return fromEntries(
    ids
      .split(/\s+/)
      .filter((id) => id !== '')
      .map((id) => [id, severity])
  )
}

/** The code files every code rule reads. */
export const CODE = ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs']

/** The files the JSDoc and boundary rules read. */
export const SCRIPT = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']

/** The TypeScript sources the workspace rules read. */
export const TYPESCRIPT = ['**/*.ts', '**/*.tsx']

/** The JavaScript files, which see the browser's and Node's globals. */
export const JAVASCRIPT = ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs']

/** The core and typescript-eslint rules the recommended sets and the workspace's adjustments leave on. */
export const CODE_RULES: Readonly<Record<string, RuleSetting>> = {
  ...on(`
    for-direction no-async-promise-executor no-case-declarations no-compare-neg-zero no-cond-assign no-constant-binary-expression
    no-constant-condition no-control-regex no-debugger no-delete-var no-dupe-else-if no-duplicate-case no-empty no-empty-character-class
    no-empty-pattern no-empty-static-block no-ex-assign no-extra-boolean-cast no-fallthrough no-global-assign no-invalid-regexp
    no-irregular-whitespace no-loss-of-precision no-misleading-character-class no-nonoctal-decimal-escape no-octal no-prototype-builtins
    no-regex-spaces no-self-assign no-shadow-restricted-names no-sparse-arrays no-unexpected-multiline no-unsafe-finally
    no-unsafe-optional-chaining no-unused-labels no-unused-private-class-members no-useless-backreference no-useless-catch no-useless-escape
    require-yield use-isnan valid-typeof no-var prefer-const prefer-rest-params prefer-spread
    typescript/ban-ts-comment typescript/no-array-constructor typescript/no-duplicate-enum-values typescript/no-empty-object-type
    typescript/no-extra-non-null-assertion typescript/no-misused-new typescript/no-namespace typescript/no-non-null-asserted-optional-chain
    typescript/no-this-alias typescript/no-unnecessary-type-constraint typescript/no-unsafe-declaration-merging typescript/no-unsafe-function-type
    typescript/no-unused-expressions typescript/no-wrapper-object-types typescript/prefer-as-const typescript/prefer-namespace-keyword
    typescript/triple-slash-reference typescript/adjacent-overload-signatures typescript/no-empty-function typescript/no-inferrable-types
    typescript/no-empty-interface
  `),
  ...on('typescript/no-explicit-any typescript/no-unused-vars typescript/no-non-null-assertion', 'warn'),
}

/** The JSDoc rules the recommended set turns on, as warnings. */
export const JSDOC_RULES: Readonly<Record<string, RuleSetting>> = {
  ...on(
    `
    jsdoc/check-access jsdoc/check-param-names jsdoc/check-property-names jsdoc/check-types jsdoc/check-values jsdoc/empty-tags
    jsdoc/escape-inline-tags jsdoc/implements-on-classes jsdoc/no-defaults jsdoc/no-types jsdoc/reject-any-type jsdoc/reject-function-type
    jsdoc/require-jsdoc jsdoc/require-next-type jsdoc/require-param jsdoc/require-param-description jsdoc/require-param-name
    jsdoc/require-property jsdoc/require-property-description jsdoc/require-property-name jsdoc/require-returns jsdoc/require-returns-check
    jsdoc/require-returns-description jsdoc/require-throws-type jsdoc/require-yields jsdoc/require-yields-check jsdoc/require-yields-type
    jsdoc/ts-no-empty-object-type jsdoc/valid-types
  `,
    'warn'
  ),
  'jsdoc/check-tag-names': ['warn', { typed: true }],
}

/** The React and hooks rules the recommended sets turn on, less the two a modern JSX transform and TypeScript make moot. */
export const REACT_RULES: Readonly<Record<string, RuleSetting>> = {
  ...on(`
    react/display-name react/jsx-key react/jsx-no-comment-textnodes react/jsx-no-duplicate-props react/jsx-no-target-blank react/jsx-no-undef
    react/jsx-uses-react react/jsx-uses-vars react/no-children-prop react/no-danger-with-children react/no-deprecated
    react/no-direct-mutation-state react/no-find-dom-node react/no-is-mounted react/no-render-return-value react/no-string-refs
    react/no-unescaped-entities react/no-unknown-property react/require-render-return
    react-hooks/rules-of-hooks
  `),
  'react-hooks/exhaustive-deps': 'warn',
}
