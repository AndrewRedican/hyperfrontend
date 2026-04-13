# require-codeblock-language

Require language identifiers on fenced code blocks in markdown files.

## Rule Details

This rule ensures that all fenced code blocks (using triple backticks) include a language identifier. Language identifiers enable:

- **Syntax highlighting**: Renders code with proper colors and formatting
- **Accessibility**: Screen readers can announce the programming language
- **Tooling support**: IDEs and documentation tools can provide better experiences
- **Clarity**: Readers immediately know what language they're looking at

### Scope

This rule applies to markdown files in:

- **Workspace root**: Top-level documentation files (README.md, ARCHITECTURE.md, CONTRIBUTING.md, etc.)
- **Publishable libraries**: Any `.md` file in a library with `build` and `publish` targets

The rule does **not** apply to:

- Markdown files in non-publishable directories
- Markdown files in subdirectories of the workspace root (e.g., `docs/`, `_/`)
- Internal documentation that is not part of published packages

## Examples

### ❌ Incorrect

````markdown
```
const x = 1
const y = 2
console.log(x + y)
```
````

````markdown
```
{
  "name": "example",
  "version": "1.0.0"
}
```
````

### ✅ Correct

````markdown
```typescript
const x = 1
const y = 2
console.log(x + y)
```
````

````markdown
```json
{
  "name": "example",
  "version": "1.0.0"
}
```
````

### ✅ Also Correct

For plain text or output that doesn't have a specific language:

````markdown
```text
This is plain text output
```
````

````markdown
```console
$ npm install
```
````

````markdown
```bash
npm run build
```
````

### Common Language Identifiers

| Language     | Identifier(s)         |
| ------------ | --------------------- |
| TypeScript   | `typescript`, `ts`    |
| JavaScript   | `javascript`, `js`    |
| JSON         | `json`, `jsonc`       |
| Bash/Shell   | `bash`, `sh`, `shell` |
| Markdown     | `markdown`, `md`      |
| HTML         | `html`                |
| CSS          | `css`                 |
| YAML         | `yaml`, `yml`         |
| Mermaid      | `mermaid`             |
| Plain text   | `text`, `plaintext`   |
| Console/Term | `console`, `terminal` |
| Diff         | `diff`                |

## When Not To Use It

If you have markdown files with legacy code blocks that cannot be easily updated, you may disable this rule for specific files using ESLint inline comments or ignore patterns.

## Related Rules

- [no-ascii-art-diagrams](./no-ascii-art-diagrams.md) - Encourages Mermaid diagrams over ASCII art
