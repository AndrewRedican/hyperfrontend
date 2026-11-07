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

The executor is called in the same process with the defaults of its schema and an [`ExecutorContext`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-ExecutorContext): the root, the project and target names, the target as configured, and every project of the workspace. An option given on the command line is read as the type the schema declares.

A generator is a function of a [`Tree`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-Tree) and its options, listed in a `generators.json` the same way. The tree records every change and writes nothing until the run ends, which is what a dry run prints. A bare generator name goes to the one workspace project that lists it, then to this package; two workspace projects offering the same name are refused until the package is named.

## Running tasks

[`runTask`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-runTask) merges the target of the project's `project.json` with the defaults in `hf.json` and runs exactly that task; nothing it depends on runs first. A shell target (`@hyperfrontend/workspace:run-commands`, or a bare command) runs through the platform shell with `node_modules/.bin` on the path. Configurations are refused.

[`planMany`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-planMany) orders the tasks of a selection by their prerequisites, and [`runPlanned`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/#api-runPlanned) runs them in that order, each in a process of its own, skipping the dependents of a failure. The affected run selects its tasks through the graph first and then runs them the same way.
