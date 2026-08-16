# reducer

The root reducer that dispatches actions to per-process state handlers and returns the next state.

`rootReducer(state, action)` is the pure function the `Store` runs on every dispatch. It owns no state itself; it routes actions to the per-process handlers that compute the next process state, then folds the results back into the workspace-level state. The reducer is intentionally thin: most of the real logic lives in the action handlers and the selectors that downstream code uses to read state out.
