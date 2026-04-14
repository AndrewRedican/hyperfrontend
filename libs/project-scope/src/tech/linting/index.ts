/**
 * Linting tool detection for ESLint, Prettier, Stylelint, and Biome.
 *
 * @module @hyperfrontend/project-scope/tech/linting
 */
export type { LintingToolDetection, LintingToolDetector } from './types'
export { ESLINT_CONFIG_PATTERNS, eslintDetector } from './eslint'
export { PRETTIER_CONFIG_PATTERNS, prettierDetector } from './prettier'
export { STYLELINT_CONFIG_PATTERNS, stylelintDetector } from './stylelint'
export { biomeDetector } from './biome'
export { detectLintingTools, lintingDetectors } from './detect-all'
