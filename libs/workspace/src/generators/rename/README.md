# rename

Renames a project and carries the new name into everything that refers to it: both manifests, the alias in `tsconfig.base.json`, the configurations of the other projects and of `hf.json`, its own README and module headers, and the projects that test the library (their names, descriptions and the tarball they pin).

```bash
npx hf generate rename my-utils shared-utils
npx hf generate rename my-utils shared-utils --packageName=@acme/shared
```

| Option          | What it sets                                                                     |
| --------------- | -------------------------------------------------------------------------------- |
| `--project`     | The current project name (also the first positional argument)                    |
| `--newName`     | The new project name                                                             |
| `--packageName` | The new package name; defaults to the new name under the package's current scope |
| `--skipFormat`  | Leave the written files unformatted                                              |

In a configuration, the project is renamed where it is listed as an implicit dependency, where a target runs after one of its tasks, written as the project, a colon and the target, and where the inputs of a target or a named input read from it. A target that only shares the project's name is left alone, and so is a project whose name merely starts with it. A command a target runs is free text and is not rewritten, so a task it names by hand is renamed by hand.

A file with nothing to rename is left as it is written. A name another project already holds is refused, so no two projects answer to one name, and so is a package name another project's package states or `tsconfig.base.json` already holds an alias under, so no alias is written over. The names the projects that test the library would take are checked the same way, and nothing is written when any of them is taken.

The sources of other projects that import the package are not rewritten; the lint rule for module boundaries reports and fixes them.
