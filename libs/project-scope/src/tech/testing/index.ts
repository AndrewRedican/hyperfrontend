/**
 * Testing framework detection for Jest, Vitest, Mocha, Cypress, and Playwright.
 *
 * @module @hyperfrontend/project-scope/tech/testing
 */
export type { TestingFrameworkDetection, TestingFrameworkDetector } from './types'
export { JEST_CONFIG_PATTERNS, jestDetector } from './jest'
export { VITEST_CONFIG_PATTERNS, vitestDetector } from './vitest'
export { MOCHA_CONFIG_PATTERNS, mochaDetector } from './mocha'
export { CYPRESS_CONFIG_PATTERNS, cypressDetector } from './cypress'
export { PLAYWRIGHT_CONFIG_PATTERNS, playwrightDetector } from './playwright'
export { detectTestingFrameworks, testingDetectors } from './detect-all'
