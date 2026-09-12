# worker

Forked-worker entry script for per-entry rollup invocations. Sits behind the [`dispatchRollupWorker`](https://www.hyperfrontend.dev/docs/libraries/builder/bundle/rollup/#api-dispatchRollupWorker) orchestrator in [`bundle/rollup/dispatch.ts`](../dispatch.ts).

The worker reads a serializable [`RollupBuildDescriptor`](https://www.hyperfrontend.dev/docs/libraries/builder/bundle/rollup/worker/#api-RollupBuildDescriptor) from `process.argv[2]`, reconstructs [`RollupOptions`](https://rollupjs.org/javascript-api/#rollup-rollup) using the same plugin factories the parent would have used in-process, runs `rollup() → bundle.write() → bundle.close()`, writes a JSON report to [`job.reportPath`](https://www.hyperfrontend.dev/docs/libraries/builder/bundle/rollup/worker/#api-RollupBuildDescriptor-prop-reportPath), and exits. Process isolation reclaims the rollup-invocation heap and RSS at exit, keeping the parent bounded across libraries with many entries (per-entry rollup invocations accumulate ~150-225MB heap and V8 retains freed pages even after explicit GC).

`runRollupWorkerJob(descriptor)` is exported so callers and tests can drive the worker logic without spawning a new Node process.
