# service

Creates a service of the workspace, a project that is built, run and deployed and never imported, written on [`@hyperfrontend/server`](https://www.hyperfrontend.dev/docs/libraries/server/): its `project.json` (stating the service kind, with the build, dev, typecheck and test targets), a private ES module `package.json` that depends on the kernel, its TypeScript, lint and test configurations, a `service.config.ts`, the service itself in `src/service.ts` with a spec that drives it whole, and an entry module, `src/main.ts`, that runs it. The new project's type check, lint and tests succeed as written.

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

`service.config.ts` default-exports a plain object whose [`immutable`](https://www.hyperfrontend.dev/docs/libraries/workspace/executors/service/#api-ServiceConfig) section holds the structural settings fixed when the service is built, and `tsconfig.lib.json` includes it, so the type check covers whatever the service comes to configure there. The service imports the file and hands the section to the runner, and the build reads the same file, so it computes nothing from the clock or the environment: a built service refuses to boot on a section other than the one it was built with.

`src/service.ts` declares the environment the service reads, the variables PORT (8080 unless set) and HOST (every interface unless set), and defines the service: a health probe at `/healthz` and one route, `GET /hello/:name`, which answers `{ "message": "Hello, <name>" }`. Its spec runs that definition through the runner with a stand-in for the process, on a port the operating system picks, and stops it again. `src/main.ts` only hands the definition to the runner, so the test configuration leaves it out of the coverage it measures.

The manifest depends on the kernel at the version the workspace provides: the version of the project behind an alias for the package in `tsconfig.base.json` when there is one, else the version installed at the root of the workspace.

A service stands with the applications wherever the two kinds of project are told apart: the module boundaries refuse an import of it, and no alias is added to `tsconfig.base.json`. The kind is written into `project.json` whatever the directory, so a service created outside apps is still read as one.

It refuses to run where the service's directory already exists or another project already holds its project name, so nothing is written over; pass `--directory` or `--projectName` to place it beside what is there. It refuses a workspace that provides no kernel, or one older than 0.2.0, and writes nothing, since without the kernel the new project's type check, lint and tests could not pass; install the package and run it again, or, where the workspace's alias names a project of its own that is too old, raise that project's version.

It also refuses a project name that holds a quote, a backslash, a control character or the two characters that end a comment, since the spec writes the name between quotes and the entry module and the configurations write it in comments. Any description is accepted: in the comment that heads the entry module, the two characters that would end the comment are written apart, and a word that opens a line with `@`, which the comment would read as a tag, is wrapped in backticks.

## Building and running

```bash
npx hf run api:dev
npx hf run api:build
```

The dev target runs the service from its sources, with no build: it starts `src/main.ts` under Node.js with the workspace's hooks loaded. The service prints one started line with the port it listens on, and stops on Ctrl+C in the terminal or, on Linux and macOS, when the command is sent a terminate signal.

The build target states its executor, `@hyperfrontend/workspace:service`, in `project.json`, so it does not hang on a default of `hf.json`. It writes the output directory `dist/<project root>`, here `dist/apps/api`:

| File                    | What it is                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main.cjs`              | The service and every package it imports, as one CommonJS module                                                                                                                     |
| `service.manifest.json` | The immutable section of `service.config.ts` and its digest                                                                                                                          |
| `hf-release.json`       | The release manifest: every other file, with its size and its SHA-256                                                                                                                |
| Assets                  | Each file the target's [`assets`](https://www.hyperfrontend.dev/docs/libraries/workspace/executors/service/#api-ServiceExecutorOptions) option matches, at its path relative to src/ |

The directory is the whole artifact: it needs no installed packages and no `package.json` where it runs. Start it with Node.js directly, so that the platform's terminate signal reaches the process:

```bash
node dist/apps/api/main.cjs
```

On boot a built service checks the directory against its release manifest and refuses to start when a file was changed, added or removed since the build, so a service keeps the data it writes somewhere else.

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

| Field      | For    | What it states                                                                                                                           |
| ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| provider   | Code   | The platform deployed to; a pipeline chooses its deploy step by it                                                                       |
| service    | Code   | The name the platform knows the deployment by, handed to that step                                                                       |
| kind       | Code   | What is deployed, such as static for a directory of files or service for a built service; a lint rule can demand what that kind requires |
| origin     | Reader | The origin the deployment answers on                                                                                                     |
| boundary   | Reader | How that origin relates to the pages that embed or call it, such as same-origin or cross-site                                            |
| publishDir | Reader | The directory a static deployment publishes                                                                                              |

Tooling keys on the first three and on nothing else; the other three describe the deployment for whoever reads the file. To deploy with `hf`, give the project a target of its own that runs the platform's command:

```json
{
  "targets": {
    "deploy": { "command": "node scripts/deploy.mjs api" }
  }
}
```

`npx hf run api:deploy` then runs that command from the workspace root and nothing before it, so build first where the command publishes a build.
