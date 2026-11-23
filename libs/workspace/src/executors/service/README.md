# service

Builds a service written on [`@hyperfrontend/server`](https://www.hyperfrontend.dev/docs/libraries/server/) into a directory that runs with `node` alone: one CommonJS main with every package inlined, the manifest of its immutable section, its assets, and a release manifest that lists every file by size and SHA-256. The main is sealed by the kernel the service installs, so the built service refuses to boot beside bytes the build did not write.

```json
{
  "build": {
    "executor": "@hyperfrontend/workspace:service",
    "options": {
      "assets": ["assets/**"]
    }
  }
}
```

| Option         | What it does                                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--outputPath` | Where the service is written, relative to the root; defaults to `dist/<project root>`                                                                      |
| `--tsConfig`   | The TypeScript configuration, relative to the root; defaults to `tsconfig.lib.json` in the project                                                         |
| `--assets`     | Globs relative to `src/`, the directory of the entry module; each match is copied to the same path beside the main. A list, so it is set in `project.json` |
| `--verbose`    | Prints the build's diagnostics                                                                                                                             |

The entry is always `src/main.ts`, and a project also needs `service.config.ts`, the TypeScript configuration and a `package.json` that states a name and a version. [`hf generate service`](https://www.hyperfrontend.dev/docs/libraries/workspace/generators/service/) writes all of them. An option the executor does not take is refused, and every problem of the options is reported at once.

## What it writes

```text
dist/apps/hello/
  main.cjs                 the bundle, executable
  service.manifest.json    the immutable section and its digest
  hf-release.json          every other file, with its size and SHA-256
  assets/notice.txt        each asset, at its path relative to src/
```

Nothing else: no `package.json` and no installed packages. Start it with `node dist/apps/hello/main.cjs`, with nothing between the platform's signal and the process. The build prints one line, `built hello release=<sha256> immutable=<sha256>`, and the running service prints the same release digest in its started line.

The output directory is emptied first when it is absent, empty or a previous build of the same service. A directory that holds anything else is refused. A build that fails once it has started writing removes what it wrote, and a build refused before that leaves the previous build as it was. A built service checks its own directory at boot, so it must not write beside its main: data lives elsewhere.

## The immutable section

`service.config.ts` default-exports a plain object with one member, [`immutable`](https://www.hyperfrontend.dev/docs/libraries/workspace/executors/service/#api-ServiceConfig), holding the structural settings fixed when the service is built. It must be JSON values only, nested no deeper than 32 levels, and the file is read twice: by the build and by the service itself, which hands the section to the runner. So the file has to give the same value every time. A section built from the clock or the environment gets another digest at boot, and the service refuses to start.

```typescript
// service.config.ts
export default { immutable: { greeting: 'Hello', limits: { names: 3 } } }
```

## Assets

In the built main every module has the main's URL, so a file is addressed the same way from source and built only when the URL is formed in a module directly in `src/`. Form the base once there and import it everywhere else:

```typescript
// src/assets.ts
export const assetsUrl = new URL('./assets/', import.meta.url)

// src/routes/notice.ts
readFileSync(fileURLToPath(new URL('notice.txt', assetsUrl)), 'utf8')
```

The build reads the service's own sources and refuses the ones that would resolve differently once built: [`import.meta.url`](https://nodejs.org/api/esm.html#importmetaurl) in a module below `src/` or in `service.config.ts`, and [`import.meta.dirname`](https://nodejs.org/api/esm.html#importmetadirname) or [`import.meta.filename`](https://nodejs.org/api/esm.html#importmetafilename) anywhere, since a built service has neither. A glob that matches no file is refused, and so is one that matches `main.cjs`, `service.manifest.json` or `hf-release.json`.

## Limits

- Every package is inlined, so a native addon cannot be built in, and there is no source map.
- The build checks that the main reaches the runner, not that it always starts through it, so keep `src/main.ts` as generated.
- A service that imports a workspace library through a path alias needs [`rootDir`](https://www.typescriptlang.org/tsconfig/#rootDir) stated in `tsconfig.base.json`, which `hf generate workspace` writes.
- The source check reads the service's own files, `service.config.ts` included, and sees a member read from [`import.meta`](https://nodejs.org/api/esm.html#importmeta) directly. It does not follow one handed to a variable first, and it does not read a workspace library, which is inlined with the main's URL.
- The release check catches a partial or changed deployment. It is not a defence against someone who can write to the directory.
