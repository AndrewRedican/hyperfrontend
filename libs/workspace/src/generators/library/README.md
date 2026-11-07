# library

Creates a TypeScript library of the workspace: its `package.json` and `project.json` (with the typecheck, test and build targets), its TypeScript, lint and test configurations, an alias in `tsconfig.base.json`, a README and a first module with its spec. With `--publishable`, the generator named make-publishable runs on it next.

```bash
npx hf generate library my-utils \
  --directory=libs --description="Shared helpers" --tags=type:util
npx hf generate library my-utils --publishable --formats=esm,cjs
```

| Option          | What it sets                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| `--name`        | The library's name, which names its directory and, with the scope, its package (also the first positional argument) |
| `--directory`   | The directory it is created under; defaults to libs                                                                 |
| `--scope`       | The npm scope; defaults to the scope of the root manifest's name, or none                                           |
| `--projectName` | The project name tasks address; defaults to the library's name                                                      |
| `--packageName` | The package name; defaults to the name under the scope                                                              |
| `--description` | The description written to both manifests                                                                           |
| `--tags`        | The tags the module boundaries read, comma-separated                                                                |
| `--publishable` | Runs make-publishable on the new library                                                                            |
| `--keywords`    | npm keywords, used with `--publishable`                                                                             |
| `--formats`     | The bundle formats, used with `--publishable`                                                                       |
| `--skipFormat`  | Leave the written files unformatted                                                                                 |

The licence and the repository come from the root manifest, with the project's directory recorded, so a package published from the library carries them.
