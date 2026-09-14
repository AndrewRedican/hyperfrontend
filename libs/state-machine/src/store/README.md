# store

The [`Store`](https://www.hyperfrontend.dev/docs/libraries/state-machine/store/#api-Store) runtime: state container, dispatch entry point, and subscription registry.

The store owns the current state, applies actions through the root reducer, and notifies subscribers on every transition. Importing from this entry point gives consumers direct access to the [`Store`](https://www.hyperfrontend.dev/docs/libraries/state-machine/store/#api-Store) class without pulling in the rest of the library; it pairs with [`/state`](https://www.hyperfrontend.dev/docs/libraries/state-machine/state/) (initial-state factory), [`/reducer`](https://www.hyperfrontend.dev/docs/libraries/state-machine/reducer/) (the dispatch engine), and [`/selectors`](https://www.hyperfrontend.dev/docs/libraries/state-machine/selectors/) (read-side predicates) to form the minimal store-only stack.
