# typecheck

Runs the TypeScript compiler over a project without emitting files: its library configuration and, when the project has one, its spec configuration. Specs run with their types stripped, so this is the one step that type checks them.

```json
{
  "typecheck": {
    "executor": "@hyperfrontend/workspace:typecheck"
  }
}
```

| Option           | What it does                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `--tsConfig`     | The library configuration; defaults to `tsconfig.lib.json` in the project                       |
| `--specTsConfig` | The spec configuration; defaults to `tsconfig.spec.json` in the project, checked when it exists |
