# feature

Nx [`feature`](https://www.hyperfrontend.dev/docs/libraries/features/nx/generators/feature/#api-featureGenerator) generator. Scaffolds a hyperfrontend feature by delegating to the
SDK's headless `hf init` (config resolution, contract loading, entry wiring),
staging every write into the Nx tree so `--dry-run` previews without touching
the disk. It first ensures [`@hyperfrontend/features`](https://www.hyperfrontend.dev/docs/libraries/features/) is declared in the root
`package.json` and returns a callback that installs (via the workspace's
`@nx/devkit` when present, a built-in installer otherwise) only when that
declaration was added. Registered via the package's `generators.json`.

## Usage

```bash
nx generate @hyperfrontend/features:feature \
  --name=clock --contract=./clock.contract.json --entry=./src/main.ts --directory=apps/clock
```

| Option                                                                                                                                | Required | Description                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------ |
| [`name`](https://www.hyperfrontend.dev/docs/libraries/features/nx/generators/feature/#api-FeatureGeneratorSchema-prop-name)           | yes      | Feature name.                                                |
| [`contract`](https://www.hyperfrontend.dev/docs/libraries/features/nx/generators/feature/#api-FeatureGeneratorSchema-prop-contract)   | yes      | Path to the contract file, relative to the target directory. |
| [`entry`](https://www.hyperfrontend.dev/docs/libraries/features/nx/generators/feature/#api-FeatureGeneratorSchema-prop-entry)         | yes      | Entry file the generated glue import is wired into.          |
| [`directory`](https://www.hyperfrontend.dev/docs/libraries/features/nx/generators/feature/#api-FeatureGeneratorSchema-prop-directory) | no       | Directory to scaffold into, relative to the workspace root.  |
| [`version`](https://www.hyperfrontend.dev/docs/libraries/features/nx/generators/feature/#api-FeatureGeneratorSchema-prop-version)     | no       | Feature version string.                                      |
| `url`                                                                                                                                 | no       | URL the generated shell loads the feature from.              |
