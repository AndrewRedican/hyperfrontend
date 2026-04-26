# framework

Cross-cutting framework identification that aggregates the `tech/*` detectors into a single, confidence-scored picture of a project's tech stack.

`identifyFrameworks` runs frontend, backend, meta-framework, build, testing, linting, and monorepo detectors against the target project, then surfaces a `summary` string (e.g. `"React + Next.js with Jest"`), the highest-confidence `primary` framework, and per-category arrays of every detected framework with `confidence` and `evidence`. `usesFramework(path, id)` is a convenience predicate for asking "does this project use Vite?" without unpacking the full identification result. Cached per project path with a short TTL; pass `{ skipCache: true }` to force fresh detection.
