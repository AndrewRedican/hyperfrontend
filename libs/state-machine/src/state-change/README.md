# state-change

State-transition tracking primitive: pairs the previous and current state of a slice for change-driven side effects.

`StateChange` represents the diff between two state snapshots so subscribers (UI render hooks, side-effect runners, lifecycle callbacks) can react to specific transitions rather than every dispatch. The class is consumed internally by `LifecycleAwareComponent` and exposed for application code that wants to build its own transition-driven behavior on top of the store.
