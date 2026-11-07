# build

Builds a library into a publishable package with [`@hyperfrontend/builder`](https://www.hyperfrontend.dev/docs/libraries/builder/), deciding what holds for every workspace: the packages the workspace's own projects carry are first-party (inlined where a format asks, left out of the published dependencies), the repository fields come from the root manifest, third-party licences are collected, and the project's README and changelog travel with the package.

```json
{
  "build": {
    "executor": "@hyperfrontend/workspace:build",
    "options": {
      "esm": { "bundleWorkspaceDeps": false },
      "cjs": { "bundleWorkspaceDeps": false },
      "iife": { "entry": ".", "globalName": "AcmeMyUtils" },
      "rootAssets": ["LICENSE.md"]
    }
  }
}
```

| Option | What it does |
| ------ | ------------ |
| `--outputPath` | Where the package is written, relative to the root; defaults to `dist/<project root>` |
| `--tsConfig` | The TypeScript configuration, relative to the root; defaults to `tsconfig.lib.json` in the project |
| `--rootAssets` | Files at the root copied into the package when they exist; `FUNDING.md` only into a package that declares funding |
| `--assets` | Further files to copy, each a source directory with file names or a glob and a destination |
| `--external` | Packages kept external in every format |
| `--esm, --cjs` | The two module formats: entries, source maps, externals, whether workspace or all dependencies are inlined |
| `--iife, --umd` | The two browser bundles: the entry, the global name, minification, externals and their globals |
| `--bin` | Executables to write beside the library from `src/bin/<name>.ts`, in either module format |
| `--dedupeSharedInternals` | Hoists first-party modules shared by several entries into one chunk; defaults to true |
| `--clean` | Empties the output directory first, when it is empty or holds a previous build; defaults to true |
| `--verbose` | Prints the build's diagnostics |

Each format is omitted to skip it. The options of a format are the builder's own, and are documented with it.
