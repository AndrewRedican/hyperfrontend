# rename

Renames a project and carries the new name into everything that refers to it: both manifests, the alias in `tsconfig.base.json`, the project references, its own README and module headers, and the project that tests the library (its names, descriptions and the tarball it pins).

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

The sources of other projects that import the package are not rewritten; the lint rule for module boundaries reports and fixes them.
