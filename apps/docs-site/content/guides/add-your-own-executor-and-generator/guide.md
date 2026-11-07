# How to add your own executor and generator to a workspace

You will be able to run a check of your own as a target (`npx hf run <project>:<target>`) and scaffold your team's kind of project with `npx hf generate <name>`, both written in TypeScript inside the repository, with no build step and no package to publish.

The packaged executors cover typecheck, test, build, e2e, publish and versioning. Anything particular to your repository (a size budget, a license scan, a service layout) belongs in a project of your own that [`@hyperfrontend/workspace`](/docs/libraries/workspace) finds by name.

The examples add a `size-budget` executor and a `service` generator to a project at `tools/`.

## 1. Declare the project that provides them

A `package.json` names the project's package and points at two manifests:

```json
{
  "name": "@acme/tools",
  "private": true,
  "executors": "./executors.json",
  "generators": "./generators.json"
}
```

A target names an executor as `<package>:<name>`, so this project's executors are `@acme/tools:<name>`. A workspace project with that package name wins over an installed package of the same name.

## 2. Write the executor

List it in `executors.json`:

```json
{
  "executors": {
    "size-budget": {
      "implementation": "./src/size-budget",
      "schema": "./src/size-budget.json",
      "description": "Fail when a built file is larger than its budget."
    }
  }
}
```

Describe its options in the schema. A `default` here is applied before the executor runs:

```json
{
  "type": "object",
  "properties": {
    "file": {
      "type": "string",
      "description": "The built file, relative to the workspace root"
    },
    "maxBytes": {
      "type": "number",
      "default": 10000,
      "description": "The largest size allowed"
    }
  },
  "required": ["file"]
}
```

Then the module, typed as an [`Executor`](/docs/libraries/workspace#api-Executor). It receives its options and an [`ExecutorContext`](/docs/libraries/workspace#api-ExecutorContext) carrying the workspace root, the project and target names, and every project of the workspace. It reports success or failure:

```ts
import type { Executor } from '@hyperfrontend/workspace'
import { statSync } from 'node:fs'
import { join } from 'node:path'

interface SizeBudgetOptions {
  file: string
  maxBytes: number
}

const sizeBudget: Executor<SizeBudgetOptions> = (options, context) => {
  const { size } = statSync(join(context.root, options.file))
  const verdict = size <= options.maxBytes ? 'within' : 'over'
  process.stdout.write(`${context.projectName}: ${options.file} is ${size} bytes, ${verdict} its budget of ${options.maxBytes}\n`)
  return { success: size <= options.maxBytes }
}

export default sizeBudget
```

## 3. Give a project the target

In the `project.json` of the project to check:

```json
{
  "targets": {
    "size": {
      "executor": "@acme/tools:size-budget",
      "dependsOn": ["build"],
      "options": { "file": "dist/libs/format/index.mjs", "maxBytes": 2000 }
    }
  }
}
```

To name the executor for every project at once, put the target under `targetDefaults` in `hf.json` instead.

## 4. Run it

```bash
npx hf run format:size
```

```text
format: dist/libs/format/index.mjs is 348 bytes, within its budget of 2000
```

An option after the task overrides the configured one, read as the type the schema declares:

```bash
npx hf run format:size --maxBytes=100
```

The task now exits 1, so `run-many` and `affected` skip whatever depends on it.

## 5. Write the generator

List it in `generators.json`:

```json
{
  "generators": {
    "service": {
      "factory": "./src/service",
      "schema": "./src/service.json",
      "description": "A library under services/, tagged as a service, with a first module."
    }
  }
}
```

The schema takes the name as the first positional argument:

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string", "": { "$source": "argv", "index": 0 } }
  },
  "required": ["name"]
}
```

A [`Generator`](/docs/libraries/workspace#api-Generator) is a function of a [`Tree`](/docs/libraries/workspace#api-Tree), which records every change and writes nothing until the generator returns. Compose the packaged `library` generator with [`runGenerator`](/docs/libraries/workspace/generators#api-runGenerator), then adjust what it wrote with [`updateJson`](/docs/libraries/workspace/generators#api-updateJson):

```ts
import type { Generator } from '@hyperfrontend/workspace'
import { runGenerator, updateJson } from '@hyperfrontend/workspace/generators'

interface ServiceOptions {
  name: string
}

const service: Generator<ServiceOptions> = async (tree, options) => {
  await runGenerator(tree, 'library', {
    name: options.name,
    directory: 'services',
  })
  updateJson<{ tags?: string[] }>(tree, `services/${options.name}/project.json`, (project) => ({
    ...project,
    tags: [...(project.tags ?? []), 'type:service'],
  }))
  tree.write(`services/${options.name}/src/index.ts`, `export const name = '${options.name}'\n`)
}

export default service
```

A bare name such as `library` resolves the way the command line resolves it: a workspace project that lists it first, then the packaged generator.

## 6. Run it

Preview first; nothing is written:

```bash
npx hf generate service billing --dry-run
```

```text
CREATE services/billing/package.json
CREATE services/billing/project.json
CREATE services/billing/src/index.ts
...
UPDATE tsconfig.base.json
hf generate: dry run, nothing written
```

Then for real:

```bash
npx hf generate service billing
```

## Check it worked

`npx hf run format:size` prints the file's size and exits 0, and `npx hf generate service billing` leaves `services/billing/project.json` tagged `type:service`, ready for `npx hf run billing:typecheck`.
