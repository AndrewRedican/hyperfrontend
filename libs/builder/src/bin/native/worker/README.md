# worker

Forked-worker entry script for postject inject. Sits behind the `dispatchInjectWorker` orchestrator in [`bin/native/dispatch.ts`](../dispatch.ts).

The worker reads a serializable `InjectWorkerJob` from `process.argv[2]`, clones the Node host binary to the output path, reads the SEA preparation blob, calls `postject.inject` to embed the blob into the cloned binary, writes a JSON report to `job.reportPath`, and exits. Process isolation reclaims the ~138 MB Buffer postject allocates while loading + rewriting the host binary, keeping the parent's RSS bounded across the rest of the SEA pipeline (the empirical pre-Phase-11.8 spike was ~1.8 GB at this exact step on memory-constrained hosts).

`runInjectWorkerJob(descriptor)` is exported so callers and tests can drive the worker logic without spawning a new Node process.
