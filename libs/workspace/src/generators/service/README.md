# service

Creates a service of the workspace, a project that is run and deployed and never imported: its `project.json` (stating the service kind, with the typecheck and test targets), a private ES module `package.json`, its TypeScript, lint and test configurations, a `service.config.ts`, and an entry module, `src/main.ts`, with a spec that passes on it. The new project's type check, lint and tests succeed as written.

```bash
npx hf generate service api --description="The public API" --tags=type:service
npx hf generate service jobs --directory=services --projectName=service-jobs
```

| Option          | What it sets                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `--name`        | The service's name, which names its directory and, with the scope of the root manifest, its package (also the first positional argument) |
| `--directory`   | The directory it is created under; defaults to apps                                                                                      |
| `--projectName` | The project name tasks address; defaults to the service's name                                                                           |
| `--description` | The description written to both manifests                                                                                                |
| `--tags`        | The tags the module boundaries read, comma-separated                                                                                     |
| `--skipFormat`  | Leave the written files unformatted                                                                                                      |

`service.config.ts` default-exports a plain object, empty to begin with, and `tsconfig.lib.json` includes it, so the type check covers whatever the service comes to configure there.

A service stands with the applications wherever the two kinds of project are told apart: the module boundaries refuse an import of it, and no alias is added to `tsconfig.base.json`. The kind is written into `project.json` whatever the directory, so a service created outside apps is still read as one.

It refuses to run where the service's directory already exists or another project already holds its project name, so nothing is written over; pass `--directory` or `--projectName` to place it beside what is there. It also refuses a project name that holds a quote, a backslash, a control character or the two characters that end a comment, since the entry module and its spec write the name between quotes and in comments. Any description is accepted: in the comment that heads the entry module, the two characters that would end the comment are written apart, and a word that opens a line with `@`, which the comment would read as a tag, is wrapped in backticks.

## Deploying

The generator writes no deploy target and the package ships no deploy executor. Where a project is deployed is recorded in its `project.json`, as the deploy object of the project's metadata. The engine reads none of it; it hands a project's metadata to executors unchanged, and a workspace's own pipeline and lint rules read it from the file. The fields are the same for every deployed project, here a static site:

```json
{
  "metadata": {
    "deploy": {
      "provider": "railway",
      "service": "docs",
      "kind": "static",
      "origin": "https://docs.example.com",
      "boundary": "cross-site",
      "publishDir": "dist/apps/docs"
    }
  }
}
```

| Field      | For    | What it states                                                                                            |
| ---------- | ------ | --------------------------------------------------------------------------------------------------------- |
| provider   | Code   | The platform deployed to; a pipeline chooses its deploy step by it                                        |
| service    | Code   | The name the platform knows the deployment by, handed to that step                                        |
| kind       | Code   | What is deployed, such as static for a directory of files; a lint rule can demand what that kind requires |
| origin     | Reader | The origin the deployment answers on                                                                      |
| boundary   | Reader | How that origin relates to the pages that embed or call it, such as same-origin or cross-site             |
| publishDir | Reader | The directory a static deployment publishes                                                               |

Tooling keys on the first three and on nothing else; the other three describe the deployment for whoever reads the file. To deploy with `hf`, give the project a target of its own that runs the platform's command:

```json
{
  "targets": {
    "deploy": { "command": "node scripts/deploy.mjs api" }
  }
}
```

`npx hf run api:deploy` then runs that command from the workspace root and nothing before it, so build first where the command publishes a build.
