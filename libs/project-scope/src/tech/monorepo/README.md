# monorepo

Monorepo-tool detectors for the workspace orchestration tools used in JavaScript/TypeScript repos.

Covers Nx, Turborepo, Lerna, Rush, and the native workspace declarations from npm, Yarn, and pnpm. Each `<tool>Detector` follows the shared [`MonorepoDetector`](https://www.hyperfrontend.dev/docs/libraries/project-scope/tech/monorepo/#api-MonorepoDetector) contract and reports a [`MonorepoDetection`](https://www.hyperfrontend.dev/docs/libraries/project-scope/tech/monorepo/#api-MonorepoDetection) with confidence, evidence, and the [`DetectionSource`](https://www.hyperfrontend.dev/docs/libraries/project-scope/tech/monorepo/#api-DetectionSource) (config file vs `package.json` field). [`detectMonorepoTools`](https://www.hyperfrontend.dev/docs/libraries/project-scope/tech/monorepo/#api-detectMonorepoTools) runs the full set against a project root and returns the aggregate.
