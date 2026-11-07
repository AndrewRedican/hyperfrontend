# make-publishable

Gives a library what a published package needs: a build target in the chosen formats, the publish, version and version-check targets, the manifest fields a registry asks for, a README where the project has none, and an e2e project with one suite per format that installs the packed tarball into a consumer outside the workspace.

```bash
npx hf generate make-publishable my-utils
npx hf generate make-publishable my-utils \
  --formats=esm,cjs,iife,umd --globalName=AcmeMyUtils
```

| Option            | What it sets                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--project`       | The project to make publishable (also the first positional argument)                                                                                                           |
| `--formats`       | The [bundle formats](https://www.hyperfrontend.dev/docs/libraries/workspace/generators/make-publishable/#api-BundleFormat) among esm, cjs, iife and umd; defaults to `esm,cjs` |
| `--globalName`    | The global for the iife and umd bundles; defaults to the scope and the name as one class name                                                                                  |
| `--bundleEntry`   | The entry the browser bundles are built from; defaults to `.`                                                                                                                  |
| `--keywords`      | npm keywords; defaults to the package's own, else its name, its scope and typescript                                                                                           |
| `--nodeEngine`    | The Node.js range the package declares; defaults to the package's own, else `>=18.0.0`                                                                                         |
| `--buildExecutor` | The executor of the build target; defaults to `@hyperfrontend/workspace:build`                                                                                                 |
| `--e2eDirectory`  | Where the e2e project is created; defaults to e2e                                                                                                                              |
| `--skipE2E`       | Write no e2e project                                                                                                                                                           |
| `--skipFormat`    | Leave the written files unformatted                                                                                                                                            |

A target the project already configures is kept; the build target gains the executor and the formats it lacks. A project that already publishes keeps every e2e file it has. The browser suites of the e2e project preload a DOM, which needs jsdom installed beside [`@hyperfrontend/testing`](https://www.hyperfrontend.dev/docs/libraries/testing/).
