# generators

What the packaged generators are built from, so a generator of your own composes them on the same tree: the tree's JSON, project and template helpers, the names and paths a generator writes, the manifest and alias updates a rename needs, and the running of a generator by name.

| Generator                                                                                                 | What it writes                                                                          |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`workspace`](https://www.hyperfrontend.dev/docs/libraries/workspace/generators/workspace/)               | The root configuration the engine reads, into a repository that has none                |
| [`library`](https://www.hyperfrontend.dev/docs/libraries/workspace/generators/library/)                   | A TypeScript library with its project, manifest, configurations and a first spec        |
| [`make-publishable`](https://www.hyperfrontend.dev/docs/libraries/workspace/generators/make-publishable/) | The targets, manifest fields, README and e2e project a published package needs          |
| [`rename`](https://www.hyperfrontend.dev/docs/libraries/workspace/generators/rename/)                     | A project's new name, carried into everything that refers to it                         |
| [`move`](https://www.hyperfrontend.dev/docs/libraries/workspace/generators/move/)                         | A project under another directory, with its names, aliases and references brought along |

A local generator composes them by name through [`runGenerator`](https://www.hyperfrontend.dev/docs/libraries/workspace/generators/#api-runGenerator), which resolves the name the way the command line does and runs the generator on the tree it is given:

```ts
import type { Generator } from '@hyperfrontend/workspace'
import { runGenerator, updateJson } from '@hyperfrontend/workspace/generators'

interface Options {
  name: string
}

const service: Generator<Options> = async (tree, options) => {
  await runGenerator(tree, 'library', {
    name: options.name,
    directory: 'services',
    tags: ['type:service'],
  })
  updateJson<{ tags?: string[] }>(tree, `services/${options.name}/project.json`, (project) => ({
    ...project,
    tags: [...(project.tags ?? []), 'scope:internal'],
  }))
}

export default service
```
