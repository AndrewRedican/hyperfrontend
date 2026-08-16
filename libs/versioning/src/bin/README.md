# CLIs: `cz` and `cl`

`@hyperfrontend/versioning` ships two command-line entries that are wired to the
npm `bin` field. Install the package and they become available as `npx cz` and
`npx cl <file>` in any consuming project.

| Bin  | Purpose                                                               |
| ---- | --------------------------------------------------------------------- |
| `cz` | Interactive conventional-commit authoring session                     |
| `cl` | Conventional-commit message validator (usable from a commit-msg hook) |

Both read their configuration from a `commit.config.{js,mjs,cjs}` file
discovered upward from the current working directory (or pointed at via
`--config`).

## `cz`: author a commit

```text
npx cz [--config <path>] [--cwd <path>]
```

| Flag              | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `--config <path>` | Explicit `commit.config.{js,mjs,cjs}` override                 |
| `--cwd <path>`    | Working directory for config discovery, git ops, scope resolve |

Walks through `type → scope → subject → body → breaking → issues → preview`,
writes the formatted message, and runs `git commit` with it. The staged files
drive the scope choices; run `git add` first.

Exit codes:

| Code  | Meaning                                                          |
| ----- | ---------------------------------------------------------------- |
| `0`   | Session committed successfully                                   |
| `1`   | Argv error, config failure, empty staging, or git commit failure |
| `130` | User cancelled the session (SIGINT / Ctrl-C)                     |

## `cl`: validate a commit message

```text
npx cl <commit-msg-path> [--config <path>] [--cwd <path>]
```

Reads the raw message from the given path, validates it against the configured
ruleset, and prints errors (`✖`) and warnings (`⚠`) to stderr. Typical use is
as a `commit-msg` hook:

```yaml
# lefthook.yml
commit-msg:
  commands:
    commitlint:
      run: npx cl {1}
```

The ruleset comes from `commit.config.*` (`validateRuleset`) when one is
loaded, otherwise the built-in conventional preset.

Exit codes:

| Code | Meaning                                                        |
| ---- | -------------------------------------------------------------- |
| `0`  | Every error-level rule passed (warnings do not block)          |
| `1`  | At least one error-level rule failed, or the bin could not run |
