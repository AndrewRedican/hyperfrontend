# feature

Nx `feature` generator. A thin wrapper that scaffolds a hyperfrontend feature by
delegating to the SDK's headless `hf init` (config resolution, contract loading,
entry wiring). Registered via the package's `generators.json`.

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
| `url`       | no       | URL the generated connector loads the feature from.          |
