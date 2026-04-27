# actions

Action creators and type constants for the async-process lifecycle.

`start`, `cancel`, `pause`, `success`, and `fail` are the canonical action creators consumed by the reducer to drive async-process state transitions. `START`, `CANCEL`, `PAUSE`, `SUCCESS`, and `FAIL` are the matching string-constant action types — exported separately so application code can reference them without re-deriving the values.
