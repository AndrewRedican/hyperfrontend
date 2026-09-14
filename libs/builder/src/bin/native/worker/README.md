# worker

Forked-worker entry script for postject inject. Sits behind the [`dispatchInjectWorker`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-dispatchInjectWorker) orchestrator in [`bin/native/dispatch.ts`](../dispatch.ts).

The worker reads a serializable [`InjectWorkerJob`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/worker/#api-InjectWorkerJob) from `process.argv[2]`, clones the Node host binary to the output path, reads the SEA preparation blob, calls [`postject.inject`](https://github.com/nodejs/postject) to embed the blob into the cloned binary, writes a JSON report to [`job.reportPath`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/worker/#api-InjectWorkerJob-prop-reportPath), and exits. Process isolation reclaims the ~138 MB Buffer postject allocates while loading + rewriting the host binary, keeping the parent's RSS bounded across the rest of the SEA pipeline (the empirical pre-Phase-11.8 spike was ~1.8 GB at this exact step on memory-constrained hosts).

`runInjectWorkerJob(descriptor)` is exported so callers and tests can drive the worker logic without spawning a new Node process.
