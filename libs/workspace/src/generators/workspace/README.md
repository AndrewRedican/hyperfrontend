# workspace

Writes the root configuration the engine reads into a repository that has none: `hf.json` with target defaults naming the packaged executors, `tsconfig.base.json` with an empty alias map, a `lint.base.config.ts` registering the project rules, `.hfignore`, and a `.gitignore` when there is none. The root `package.json`, where there is one, becomes an ES module package (`"type": "module"`, which the configurations written need to load) and gains `@types/node` among its development dependencies on the major of the running Node.js, for the next `npm install` to fetch. It refuses to run where `hf.json` already exists.

```bash
npx hf generate workspace
```

| Option         | What it sets                                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--hooks`      | Also write a first `hooks.config.ts`, ignore the clone's local file and install the Git hook stubs                                                                                                                |
| `--prepare`    | With `--hooks`, add the root [`prepare`](https://www.hyperfrontend.dev/docs/libraries/workspace/generators/workspace/#api-WorkspaceGeneratorOptions-prop-prepare) script that installs the hooks on every install |
| `--skipFormat` | Leave the written files unformatted                                                                                                                                                                               |

With `--hooks` it does what the [`hooks`](https://www.hyperfrontend.dev/docs/libraries/workspace/generators/hooks/) generator does in a workspace that has no configuration. It adds no script to the root manifest unless `--prepare` asks for one, so installing the repository runs nothing the repository did not ask for.

This is the one generator that runs where no `hf.json` exists yet; the working directory is the root.
