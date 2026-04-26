# store

The `Store` runtime: state container, dispatch entry point, and subscription registry.

The store owns the current state, applies actions through the root reducer, and notifies subscribers on every transition. Importing from this entry point gives consumers direct access to the `Store` class without pulling in the rest of the library; it pairs with `/state` (initial-state factory), `/reducer` (the dispatch engine), and `/selectors` (read-side predicates) to form the minimal store-only stack.
