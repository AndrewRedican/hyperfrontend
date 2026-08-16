# feature

Nx `feature` generator. Scaffolds a hyperfrontend feature by delegating to the
SDK's headless `hf init` (config resolution, contract loading, entry wiring),
staging every write into the Nx tree so `--dry-run` previews without touching
the disk. It first ensures `@hyperfrontend/features` is declared in the root
`package.json` and returns a callback that installs (via the workspace's
`@nx/devkit` when present, a built-in installer otherwise) only when that
declaration was added. Registered via the package's `generators.json`.

## Usage

```bash
nx generate @hyperfrontend/features:feature \
  --name=clock --contract=./clock.contract.json --entry=./src/main.ts --directory=apps/clock
```

| Option      | Required | Description                                                  |
| ----------- | -------- | ------------------------------------------------------------ |
| `name`      | yes      | Feature name.                                                |
| `contract`  | yes      | Path to the contract file, relative to the target directory. |
| `entry`     | yes      | Entry file the generated glue import is wired into.          |
| `directory` | no       | Directory to scaffold into, relative to the workspace root.  |
| `version`   | no       | Feature version string.                                      |
| `url`       | no       | URL the generated shell loads the feature from.              |
