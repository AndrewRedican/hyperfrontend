# runner

The engine: the contract an executor or generator is written against, the resolution of the package that provides one, and the running of one task, of many in order, and of the tasks a change affects.

## Writing an executor

A target names an executor as `<package>:<name>`. The package is the workspace project whose manifest carries that name, else the package of that name among the installed packages; its manifest names an `executors.json`, which names each module and schema, looked for beside the manifest and then under `src/`. A module written in TypeScript loads from source.

```json
{
  "executors": {
    "hello": {
      "implementation": "./src/hello",
      "schema": "./src/hello.json",
      "description": "Says hello"
    }
  }
}
```

```ts
import type { Executor } from '@hyperfrontend/workspace'

interface Options {
  name: string
}

const hello: Executor<Options> = (options, context) => {
  process.stdout.write(`hello ${options.name} from ${context.projectName}\n`)
  return { success: true }
}

export default hello
```

The executor is called in the same process with the defaults of its schema and an [`ExecutorContext`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-ExecutorContext): the root, the project and target names, the target as configured, and every project of the workspace. An option given on the command line is read as the type the schema declares. An option the schema lists under [`required`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-ExecutorSchema-prop-required) that neither the target nor the command line gives is refused before the executor runs, naming the option and the executor.

A generator is a function of a [`Tree`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-Tree) and its options, listed in a `generators.json` the manifest names under [`generators`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-GeneratorsManifest-prop-generators), each entry naming its module under [`factory`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-GeneratorEntry-prop-factory) rather than [`implementation`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-ExecutorEntry-prop-implementation):

```json
{
  "generators": {
    "note": {
      "factory": "./src/note/generator",
      "schema": "./src/note/schema.json",
      "description": "Writes a note"
    }
  }
}
```

The manifest's `package.json` points at both files: `"executors": "./executors.json"` and `"generators": "./generators.json"`. The tree records every change and writes nothing until the run ends, which is what a dry run prints. A bare generator name goes to the one workspace project that lists it, then to this package; two workspace projects offering the same name are refused until the package is named.

## Running tasks

[`runTask`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-runTask) merges the target of the project's `project.json` with the defaults in `hf.json` and runs exactly that task; nothing it depends on runs first. A shell target (`@hyperfrontend/workspace:run-commands`, or a bare command) runs through the platform shell with `node_modules/.bin` on the path. Configurations are refused.

[`planMany`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-planMany) orders the tasks of a selection by their prerequisites, and [`runPlanned`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-runPlanned) runs them in that order, each in a process of its own, skipping the dependents of a failure. The affected run selects its tasks through the graph first and then runs them the same way.

## Stages and the progress view

What the command line shows of a run is built from parts that know nothing of how a task is executed, so a runner of your own can show the same thing.

[`assignStages`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-assignStages) gives every task the first stage that names its target and moves a prerequisite to the earliest stage that needs it. [`runStages`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-runStages) runs the stages in order through a function you supply and stops after the first that did not succeed whole, answering the tasks that never started.

[`createProgressView`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-createProgressView) writes a line as each task ends, the excerpt of a failed task's log from [`failureExcerpt`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-failureExcerpt), a sign of life for a task that runs long, and at the end the matrix of [`matrixLines`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-matrixLines) with the totals. It writes through a [`Terminal`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-Terminal) from [`createTerminal`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-createTerminal), which rewrites a status line on a terminal and writes plain lines everywhere else.

```ts
import { assignStages, createProgressView, createTerminal, Ending, runStages } from '@hyperfrontend/workspace/runner'

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
