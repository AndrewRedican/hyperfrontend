# progress

The stages of a run and the view of it, as the command line shows them: which tasks run before which, where a failure stops the run, and what a terminal is shown while it goes.

What the command line shows of a run is built from parts that know nothing of how a task is executed, so a runner of your own can show the same thing.

[`assignStages`](https://www.hyperfrontend.dev/docs/libraries/workspace/progress/#api-assignStages) gives every task the first stage that names its target and moves a prerequisite to the earliest stage that needs it. [`runStages`](https://www.hyperfrontend.dev/docs/libraries/workspace/progress/#api-runStages) runs the stages in order through a function you supply and stops after the first that did not succeed whole, answering the tasks that never started.

[`createProgressView`](https://www.hyperfrontend.dev/docs/libraries/workspace/progress/#api-createProgressView) writes a line as each task ends, the excerpt of a failed task's log from [`failureExcerpt`](https://www.hyperfrontend.dev/docs/libraries/workspace/progress/#api-failureExcerpt), a sign of life for a task that runs long, and at the end the matrix of [`matrixLines`](https://www.hyperfrontend.dev/docs/libraries/workspace/progress/#api-matrixLines) with the totals. It writes through a [`Terminal`](https://www.hyperfrontend.dev/docs/libraries/workspace/progress/#api-Terminal) from [`createTerminal`](https://www.hyperfrontend.dev/docs/libraries/workspace/progress/#api-createTerminal), which rewrites a status line on a terminal and writes plain lines everywhere else.

```ts
import { assignStages, createProgressView, createTerminal, Ending, runStages } from '@hyperfrontend/workspace/progress'

const tasks = [
  { id: 'lib-core:lint', project: 'lib-core', target: 'lint', needs: [] },
  { id: 'lib-core:test', project: 'lib-core', target: 'test', needs: [] },
]
const stages = [['lint'], ['test']]
const stageOf = assignStages(tasks, stages)
const view = createProgressView({
  tasks: tasks.map((task) => ({ ...task, stage: stageOf.get(task.id) ?? 0 })),
  stages: stages.length,
  terminal: createTerminal(process.stderr, process.env),
  now: Date.now,
})

const { stopped } = await runStages({
  tasks,
  stageOf,
  runStage: async (members, stage) => {
    view.stage(stage)
    for (const task of members) {
      view.started(task.id)
      view.ended({
        id: task.id,
        ending: Ending.Passed,
        durationMs: 1200,
        detail: null,
        excerpt: null,
        log: null,
      })
    }
    return true
  },
})
view.finish(stopped)
```
