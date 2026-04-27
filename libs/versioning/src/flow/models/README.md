# models

Type definitions and immutable builders for version flows and their steps.

`VersionFlow` is the top-level shape carrying steps, configuration, and metadata; `FlowStep` is the per-step shape carrying an ID, a condition, and an executor. `createFlow`, `addStep`, `removeStep`, `insertStep`, `insertStepAfter`, and `insertStepBefore` are the immutable builders — every operation returns a new `VersionFlow` rather than mutating in place. `FlowConfig`, `FlowContext`, `FlowResult`, `FlowState`, `FlowStatus`, `FlowStepResult`, and `FlowStepResultWithId` describe the runtime surface that the executor threads through each step.
