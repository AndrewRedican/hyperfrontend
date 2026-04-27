# linting

Linting-tool detectors for code-quality tools commonly found alongside JavaScript/TypeScript projects.

Covers ESLint, Prettier, Stylelint, and Biome. Each `<tool>Detector` follows the shared `LintingToolDetector` contract; tools that ship multiple config-file shapes also expose a `<TOOL>_CONFIG_PATTERNS` constant. `detectLintingTools` runs the full set and returns the aggregate `LintingToolDetection[]`.
