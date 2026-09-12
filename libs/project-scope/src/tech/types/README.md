# types

Type-system detectors covering the typing approaches found in JavaScript codebases.

Covers TypeScript, Flow, and JSDoc-typed JavaScript. [`typescriptDetector`](https://www.hyperfrontend.dev/docs/libraries/project-scope/tech/types/#api-typescriptDetector), [`flowDetector`](https://www.hyperfrontend.dev/docs/libraries/project-scope/tech/types/#api-flowDetector), and [`jsdocDetector`](https://www.hyperfrontend.dev/docs/libraries/project-scope/tech/types/#api-jsdocDetector) each follow the shared [`TypeSystemDetector`](https://www.hyperfrontend.dev/docs/libraries/project-scope/tech/types/#api-TypeSystemDetector) contract; [`detectTypeSystems`](https://www.hyperfrontend.dev/docs/libraries/project-scope/tech/types/#api-detectTypeSystems) runs them all and returns the aggregate `TypeSystemDetection[]`. Allows downstream tooling to make type-system-aware decisions without hard-coding "if `tsconfig.json` exists" checks.
