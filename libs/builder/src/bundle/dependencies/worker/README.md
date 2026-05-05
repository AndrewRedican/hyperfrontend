# worker

Forked-worker entry script for the dependency pre-pass. Sits behind the `runPrePass` orchestrator in [`bundle/dependencies/pre-pass.ts`](../pre-pass.ts).

The worker reads a serializable `PrePassWorkerJob` from `process.argv[2]`, reconstructs `RollupOptions` for either the JS pre-pass (`json` + `nodeResolve` + `commonjs`) or the d.ts pre-pass (`rollup-plugin-dts`), runs `rollup() → bundle.write() → bundle.close()`, writes a JSON report to `job.reportPath`, and exits. Process isolation reclaims the rollup-invocation heap and RSS at exit so each dep is pre-passed in a fresh address space, keeping the parent bounded across the full dep set.

`runPrePassWorkerJob(job)` is exported so callers and tests can drive the worker logic without spawning a new Node process.
