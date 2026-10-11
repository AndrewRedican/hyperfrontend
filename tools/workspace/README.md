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

## Compatibility matrix

The root `LIBRARY_COMPATIBILITY.md` is derived from every publishable package's `project.json` and `package.json`. This package holds the one generator every writer of that document shares:

| Export                                  | Purpose                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `collectMatrixLibraries(workspaceRoot)` | Reads the rows: one per publishable library under `libs/` and `plugins/`, sorted by package name.         |
| `renderCompatibilityDocument(rows)`     | Renders the document text from collected rows.                                                            |
| `buildCompatibilityDocument(root)`      | Both steps in one call; what the lint rule compares the committed file against.                           |
| `refreshCompatibilityDocument(root)`    | Writes the document when its content changed and returns its path, or `null` when it was already current. |

The `lib-compatibility-matrix` lint rule checks and fixes the committed file through `buildCompatibilityDocument`; the version flow in `@hyperfrontend/package` calls `refreshCompatibilityDocument` after every bump so the regenerated document travels in the version commit.

## Node.js floor probe

`scripts/probe-node-floor.mjs` loads every export entry of every built package under `dist/libs`, each in a child process of its own, both as `import` and as `require`, and fails when any of them cannot load. The packages declare `engines.node` while the toolchain runs on a far newer release, so this is the only check that notices an entry reading a global the floor does not have. It is plain JavaScript with no dependencies so it runs on the floor release itself; the `node-floor` CI job builds the packages on the toolchain Node.js, switches to the exact floor read from `engines.node`, and runs it.

```bash
npx nx run-many -t build --projects=tag:scope:public
npx -y -p node@18.0.0 node tools/workspace/scripts/probe-node-floor.mjs
```

One table at the top of the script carries the documented exceptions: entries that need a Node flag on some releases, passed the way the shipping code passes it. Keep it in step with the package READMEs. The probe checks that an entry loads, not that every export works: an API the floor lacks that is only read at call time still needs its own note in the package README.

## Future Executors

- `typecheck-report` — Type error report
- `test-report` — Test failure report
