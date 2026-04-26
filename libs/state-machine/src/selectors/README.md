# selectors

Predicate functions for querying async-process state out of a `Store` snapshot.

`notStarted`, `inProgress`, `done`, `successful`, `failed`, `retrying`, `restarting`, `halted`, `paused`, and `cancelled` answer single-question predicates over a process state. `derivedState` returns the canonical phase string for a process so UI code can render a single source-of-truth label instead of testing each predicate. All selectors are pure and work over any state slice that conforms to the async-process shape — they are not tied to a specific store instance.
