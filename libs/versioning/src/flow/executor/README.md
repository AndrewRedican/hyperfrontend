# executor

Flow execution engine: runs a `VersionFlow` end-to-end with dry-run, validation, and structured result reporting.

`executeFlow` walks the steps of a flow in declared order, invoking each step's executor with the current `FlowContext`, threading state through `FlowStepResult[]`, and short-circuiting on the first failed step (or on the first step whose `condition` opts out). `dryRun` performs the same traversal but instructs each step to report what it would do without performing side effects — useful for validating release plans before publishing. `validateFlow` walks the flow definition only (not the runtime context) and surfaces structural problems such as duplicate step IDs, missing dependencies, or invalid configuration.
