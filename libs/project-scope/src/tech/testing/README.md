# testing

Testing-framework detectors for the unit, integration, and e2e tools commonly used in JavaScript/TypeScript projects.

Covers Jest, Vitest, Mocha, Cypress, and Playwright. Each `<tool>Detector` follows the shared `TestingFrameworkDetector` contract and pairs with a `<TOOL>_CONFIG_PATTERNS` constant describing the config-file shapes it recognizes. `detectTestingFrameworks` runs all detectors against the project and returns the aggregate `TestingFrameworkDetection[]`.
