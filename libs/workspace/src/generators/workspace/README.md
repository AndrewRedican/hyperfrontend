# workspace

Writes the root configuration the engine reads into a repository that has none: `hf.json` with target defaults naming the packaged executors, `tsconfig.base.json` with an empty alias map, a `lint.base.config.ts` registering the project rules, `.hfignore`, and a `.gitignore` when there is none. It refuses to run where `hf.json` already exists.

```bash
npx hf generate workspace
```

| Option         | What it sets                        |
| -------------- | ----------------------------------- |
| `--skipFormat` | Leave the written files unformatted |

This is the one generator that runs where no `hf.json` exists yet; the working directory is the root.
