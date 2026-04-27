# events

Event-driven state primitives: a small pub/sub registry used as a building block by other state-machine pieces.

`Events` exposes `on`, `off`, and `emit` over typed event names so components can subscribe to lifecycle and state-change notifications without coupling to the dispatcher that publishes them. Used internally by `LifecycleAwareComponent` and `Store` to surface state transitions; available on its own for application code that wants the same shape without dragging in a full store.
