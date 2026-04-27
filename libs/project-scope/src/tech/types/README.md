# types

Type-system detectors covering the typing approaches found in JavaScript codebases.

Covers TypeScript, Flow, and JSDoc-typed JavaScript. `typescriptDetector`, `flowDetector`, and `jsdocDetector` each follow the shared `TypeSystemDetector` contract; `detectTypeSystems` runs them all and returns the aggregate `TypeSystemDetection[]`. Allows downstream tooling to make type-system-aware decisions without hard-coding "if `tsconfig.json` exists" checks.
