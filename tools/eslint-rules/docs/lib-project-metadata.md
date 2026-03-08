# lib-project-metadata

Require essential metadata in publishable library project.json files.

## Rule Details

This rule ensures publishable libraries have required metadata in their `project.json`:

- `name` - Must start with `lib-` prefix
- `description` - Human-readable description
- `tags` - Non-empty array of tags for categorization

### Why?

- **Naming convention**: The `lib-` prefix distinguishes libraries from applications
- **Documentation**: Description helps developers understand the library's purpose
- **Categorization**: Tags enable filtering and organizing libraries (e.g., `type:util`, `scope:public`)

## Examples

### ❌ Incorrect

```json
{
  "name": "my-library"
}
```

```json
{
  "name": "lib-utils",
  "tags": []
}
```

### ✅ Correct

```json
{
  "name": "lib-utils",
  "description": "General purpose utility functions",
  "tags": ["type:util", "scope:public"]
}
```

## When Not To Use It

If you use a different naming convention or don't require these metadata fields.

## Related Rules

- [lib-project-bundle-config](./lib-project-bundle-config.md)
- [lib-pkg-fields](./lib-pkg-fields.md)
