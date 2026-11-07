# publish

Publishes a library's build output to the npm registry, and skips a version the registry already has, so the same task can run again after a partial release.

```json
{
  "publish": {
    "executor": "@hyperfrontend/workspace:publish",
    "dependsOn": ["build"]
  }
}
```

| Option         | What it does                                                           |
| -------------- | ---------------------------------------------------------------------- |
| `--dryRun`     | Shows what would be published and uploads nothing                      |
| `--registry`   | The registry; defaults to the one npm is configured with               |
| `--tag`        | The dist-tag; defaults to latest                                       |
| `--access`     | The access of a scoped package; defaults to public                     |
| `--otp`        | A one-time password for two-factor publishing                          |
| `--provenance` | Attaches the provenance statement npm signs with the CI identity token |

The token comes from NPM_TOKEN in the environment.

```bash
npx hf run my-utils:publish --dryRun
```
