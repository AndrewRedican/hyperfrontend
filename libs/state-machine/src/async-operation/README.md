# async-operation

State-tracking wrapper for a single asynchronous process.

`AsyncOperation` is the runtime object that owns the state of one async process: not-started, in-progress, paused, done, failed, retrying, etc. It dispatches the actions in `/actions` against the reducer and exposes selectors so consumers can query the process state without importing the reducer directly. `AsyncProcess` is the data shape held inside the operation — useful when the operation is composed into larger structures or persisted. Reach for the higher-level `/coordinated-async-operation` when several related async processes need to be orchestrated together.
