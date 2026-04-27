# state

Initial-state factory for constructing a fresh state-machine state object.

`createInitialState()` returns the canonical empty state shape that the `Store` expects on construction. Use it when wiring up a store directly, when seeding tests, or when resetting a long-lived store back to a known-good initial value.
