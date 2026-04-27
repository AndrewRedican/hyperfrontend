# monorepo

Monorepo-tool detectors for the workspace orchestration tools used in JavaScript/TypeScript repos.

Covers Nx, Turborepo, Lerna, Rush, and the native workspace declarations from npm, Yarn, and pnpm. Each `<tool>Detector` follows the shared `MonorepoDetector` contract and reports a `MonorepoDetection` with confidence, evidence, and the `DetectionSource` (config file vs `package.json` field). `detectMonorepoTools` runs the full set against a project root and returns the aggregate.
