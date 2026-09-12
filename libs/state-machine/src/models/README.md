# models

Shared type definitions for state-machine state, actions, and reducers.

This entry point re-exports the cross-cutting types consumed by the runtime modules ([`store`](https://www.hyperfrontend.dev/docs/libraries/state-machine/store/), [`reducer`](https://www.hyperfrontend.dev/docs/libraries/state-machine/reducer/), [`selectors`](https://www.hyperfrontend.dev/docs/libraries/state-machine/selectors/), [`state-change`](https://www.hyperfrontend.dev/docs/libraries/state-machine/state-change/)). Consumers writing their own action handlers or reducers import from here to stay aligned with the shapes the rest of the library expects, without having to dig into module-private files.
