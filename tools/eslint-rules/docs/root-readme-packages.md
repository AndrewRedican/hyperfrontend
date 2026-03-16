# root-readme-packages

Ensure root README.md lists all publishable library projects in Main Packages or Internal Packages sections.

## Rule Details

This rule validates that the root workspace README.md includes all publishable library projects from `libs/` and `plugins/` folders in either the "Main Packages" or "Internal Packages" section.

### What is a Publishable Library?

A project is considered a publishable library if:

1. Located in `libs/` or `plugins/` directory
2. Has a `project.json` with `projectType: "library"`
3. Has both `build` and `publish` targets defined

### Required Sections

The root README.md must have:

- `## Main Packages` - For primary user-facing packages
- `## Internal Packages` - For internal/utility packages

Each publishable library must appear in one of these sections with a GitHub link in the format:

```markdown
| [package-name](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/package-name) | Description |
```

### Why?

- **Discoverability**: Users can find all available packages in one place
- **Consistency**: Ensures documentation stays in sync with actual publishable projects
- **Completeness**: Prevents new libraries from being published without documentation
- **Maintainability**: CI can catch missing packages before merge

## Examples

### ❌ Incorrect

Missing a publishable library:

```markdown
# hyperfrontend

## Main Packages

| Package                                                   | Description  |
| --------------------------------------------------------- | ------------ |
| [@hyperfrontend/nexus](https://github.com/.../libs/nexus) | Core library |

## Internal Packages

| Package                                        | Description   |
| ---------------------------------------------- | ------------- |
| [logging](https://github.com/.../libs/logging) | Logging utils |

<!-- Missing: libs/cryptography which has build + publish targets -->
```

Missing required section:

```markdown
# hyperfrontend

## Main Packages

| Package                                                   | Description  |
| --------------------------------------------------------- | ------------ |
| [@hyperfrontend/nexus](https://github.com/.../libs/nexus) | Core library |

<!-- Missing: ## Internal Packages section -->
```

### ✅ Correct

All publishable libraries listed:

```markdown
# hyperfrontend

## Main Packages

| Package                                                            | Description  |
| ------------------------------------------------------------------ | ------------ |
| [@hyperfrontend/features](https://github.com/.../plugins/features) | Nx plugin    |
| [@hyperfrontend/nexus](https://github.com/.../libs/nexus)          | Core library |

## Internal Packages

| Package                                                  | Description   |
| -------------------------------------------------------- | ------------- |
| [cryptography](https://github.com/.../libs/cryptography) | Crypto utils  |
| [logging](https://github.com/.../libs/logging)           | Logging utils |
| [json-utils](https://github.com/.../libs/utils/json)     | JSON utils    |
```

## When Not To Use It

This rule is specifically designed for the hyperfrontend monorepo root README. Disable it if:

- You're working on a different project structure
- You intentionally want some publishable libraries to remain undocumented

## Related Rules

- [lib-readme-structure](./lib-readme-structure.md) - Validates individual library README structure
