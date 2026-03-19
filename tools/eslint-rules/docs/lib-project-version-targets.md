# lib-project-version-targets

Require version and version-check targets in publishable library project.json.

## Rule Details

This rule ensures that publishable libraries have both `version` and `version-check` targets configured.

### Why?

- **Automated versioning**: The `version` target enables automated version bumps based on conventional commits
- **CI validation**: The `version-check` target enables PR validation to ensure version bumps are applied locally before merge
- **Consistent workflow**: Ensures the versioning system works end-to-end with both bump and validation steps
- **Early failure detection**: Catches missing configuration during development rather than in CI

## Examples

### ❌ Incorrect

```json
{
  "name": "lib-utils",
  "targets": {
    "build": {},
    "publish": {}
  }
}
```

```json
{
  "name": "lib-utils",
  "targets": {
    "build": {},
    "publish": {},
    "version": {}
  }
}
```

### ✅ Correct

```json
{
  "name": "lib-utils",
  "targets": {
    "build": {},
    "publish": {},
    "version": {},
    "version-check": {}
  }
}
```

## When Not To Use It

If you don't use automated version validation in CI or have a different versioning workflow.

## Related Rules

- [lib-project-metadata](./lib-project-metadata.md)
- [lib-project-bundle-config](./lib-project-bundle-config.md)
