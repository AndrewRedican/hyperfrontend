# application

Creates an application of the workspace, a project that is run and never imported: its `project.json` (stating the application kind, with the typecheck and test targets), a private ES module `package.json`, its TypeScript, lint and test configurations, and an entry module, `src/main.ts`, with a spec that passes on it. The new project's type check, lint and tests succeed as written.

```bash
npx hf generate application web --description="The public site" --tags=type:app
npx hf generate application admin \
  --directory=apps/internal --projectName=app-admin
```

| Option          | What it sets                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `--name`        | The application's name, which names its directory and, with the scope of the root manifest, its package (also the first positional argument) |
| `--directory`   | The directory it is created under; defaults to apps                                                                                          |
| `--projectName` | The project name tasks address; defaults to the application's name                                                                           |
| `--description` | The description written to both manifests                                                                                                    |
| `--tags`        | The tags the module boundaries read, comma-separated                                                                                         |
| `--skipFormat`  | Leave the written files unformatted                                                                                                          |

The kind is written into `project.json` whatever the directory, so an application created outside apps is still read as one. No alias is added to `tsconfig.base.json`: the module boundaries refuse an import of an application, so nothing needs a name to import it by.

It refuses to run where the application's directory already exists or another project already holds its project name, so nothing is written over; pass `--directory` or `--projectName` to place it beside what is there. It also refuses a project name that holds a quote, a backslash, a control character or the two characters that end a comment, since the entry module and its spec write the name between quotes and in comments. Any description is accepted: in the comment that heads the entry module, the two characters that would end the comment are written apart, and a word that opens a line with `@`, which the comment would read as a tag, is wrapped in backticks.
