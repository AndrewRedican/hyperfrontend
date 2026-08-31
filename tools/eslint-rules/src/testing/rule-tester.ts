import { RuleTester as TypeScriptRuleTester } from '@typescript-eslint/rule-tester'
import { RuleTester } from 'eslint'
import jsoncParser from 'jsonc-eslint-parser'

/**
 * Configuration for JSON rule tester.
 */
export interface JsonRuleTesterConfig {
  /**
   * Additional language options to merge.
   */
  languageOptions?: Record<string, unknown>
}

/**
 * Configuration for TypeScript rule tester.
 */
export interface TypeScriptRuleTesterConfig {
  /**
   * Whether to use project service.
   *
   * @default false
   */
  projectService?: boolean

  /**
   * Path to tsconfig.json.
   */
  tsconfigRootDir?: string

  /**
   * Additional language options to merge.
   */
  languageOptions?: Record<string, unknown>
}

/**
 * Creates a RuleTester configured for JSON/JSONC files.
 * Uses jsonc-eslint-parser.
 *
 * @param config - Optional configuration overrides
 * @returns A configured RuleTester instance
 *
 * @example
 * ```typescript
 * const ruleTester = createJsonRuleTester()
 *
 * ruleTester.run('my-json-rule', rule, {
 *   valid: [...],
 *   invalid: [...]
 * })
 * ```
 */
export function createJsonRuleTester(config?: JsonRuleTesterConfig): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser: jsoncParser,
      ...config?.languageOptions,
    },
  })
}

/**
 * Creates a RuleTester configured for TypeScript files.
 * Uses `@typescript-eslint/parser`.
 *
 * @param config - Optional configuration overrides
 * @returns A configured TypeScriptRuleTester instance
 *
 * @example
 * ```typescript
 * const ruleTester = createTypeScriptRuleTester()
 *
 * ruleTester.run('my-ts-rule', rule, {
 *   valid: [...],
 *   invalid: [...]
 * })
 * ```
 */
export function createTypeScriptRuleTester(config?: TypeScriptRuleTesterConfig): TypeScriptRuleTester {
  return new TypeScriptRuleTester({
    languageOptions: {
      parserOptions: {
        projectService: config?.projectService ?? false,
        ...(config?.tsconfigRootDir && { tsconfigRootDir: config.tsconfigRootDir }),
      },
      ...config?.languageOptions,
    },
  })
}

/**
 * Creates a RuleTester configured for package.json files specifically.
 * Uses jsonc-eslint-parser with JSON-specific settings.
 *
 * Alias for createJsonRuleTester() for semantic clarity.
 *
 * @param config - Optional configuration overrides
 * @returns A configured RuleTester instance
 */
export function createPackageJsonRuleTester(config?: JsonRuleTesterConfig): RuleTester {
  return createJsonRuleTester(config)
}

/**
 * Creates a RuleTester configured for project.json files specifically.
 * Uses jsonc-eslint-parser with JSON-specific settings.
 *
 * Alias for createJsonRuleTester() for semantic clarity.
 *
 * @param config - Optional configuration overrides
 * @returns A configured RuleTester instance
 */
export function createProjectJsonRuleTester(config?: JsonRuleTesterConfig): RuleTester {
  return createJsonRuleTester(config)
}

/**
 * Re-export RuleTester types for convenience.
 */
export type { RuleTester as ESLintRuleTester } from 'eslint'
export { RuleTester as TypeScriptRuleTester } from '@typescript-eslint/rule-tester'
