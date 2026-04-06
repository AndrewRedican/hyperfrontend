# @hyperfrontend/workspace

Nx plugin providing workspace-wide executors for LLM-optimized reports.

## Executors

### lint-report

Run lint across all projects and generate a compact, LLM-formatted report.

```bash
npx nx run @hyperfrontend/workspace:lint:all
```

**Output:** `lint-output.txt` at workspace root (gitignored).

#### Options

| Option        | Type    | Default           | Description                                   |
| ------------- | ------- | ----------------- | --------------------------------------------- |
| `outputPath`  | string  | `lint-output.txt` | Output file path relative to workspace root   |
| `affected`    | boolean | `false`           | Only lint affected projects (vs all)          |
| `maxFixes`    | number  | `5`               | Number of files to suggest fixing first       |
| `failOnError` | boolean | `true`            | Exit with non-zero code when errors are found |

## Future Executors

- `typecheck-report` — Type error report
- `test-report` — Test failure report
