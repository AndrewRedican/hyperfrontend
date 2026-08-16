# lifecycle-aware-component

A component base that exposes `initializing`, `ready`, `starting`, `stopping`, and `active` state phases plus per-phase change callbacks.

`LifecycleAwareComponent` models a stateful component whose visibility to consumers depends on which phase it has reached: for example, a UI element that should only render after `ready` or a service that needs to drain in-flight work on `stopping` before becoming inactive. Each phase exposes a typed change callback (`InitializingChangeCallback`, `ReadyChangeCallback`, `StartingChangeCallback`, `StoppingChangeCallback`, `ActiveChangeCallback`) so subclasses or wrappers can react when the component crosses a boundary. The component composes the lower-level `Events` registry under the hood; reach for it when you need a structured lifecycle rather than raw pub/sub.
