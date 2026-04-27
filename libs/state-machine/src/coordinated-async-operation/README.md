# coordinated-async-operation

Orchestrator for multiple related async processes, exposing aggregate state across the group.

`CoordinatedAsyncProcess` wraps a set of `AsyncOperation` instances and presents them as one unit: lifecycle actions (`start`, `pause`, `cancel`) fan out to every member; selectors (`inProgress`, `done`, `failed`, ...) report the group-level state derived from the constituents. Use this when an application step depends on several async pieces completing together — for example, fetching a record and its related entities — and you want a single object to render against rather than coordinating the individual processes by hand.
