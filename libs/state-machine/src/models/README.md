# models

Shared type definitions for state-machine state, actions, and reducers.

This entry point re-exports the cross-cutting types consumed by the runtime modules (`store`, `reducer`, `selectors`, `state-change`). Consumers writing their own action handlers or reducers import from here to stay aligned with the shapes the rest of the library expects, without having to dig into module-private files.
