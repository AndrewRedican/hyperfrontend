# author/

Interactive commit authoring session.

## Overview

Step-sequenced session that accumulates a conventional commit draft
field-by-field (type → scope → subject → body → breaking → issues), renders
a preview, and (by default) executes `git commit`. Each step is a small
pure-ish function operating over a shared `SessionContext`; the runner
walks the list, honors `goto` jumps (used by the preview's
"commit this message? no" restart), and surfaces Ctrl-C as a `cancelled`
outcome.

```mermaid
flowchart LR
    subgraph Config
        CL[config-loader]
        RC[resolve-config]
    end

    subgraph Resolvers
        SP[staged-paths]
        SD[scope-discovery]
        DS[default-scope]
    end

    subgraph Steps
        RS[resolve-scope]
        T[type]
        S[scope]
        SUB[subject]
        B[body]
        BR[breaking]
        I[issues]
        P[preview]
        C[commit]
    end

    subgraph Runner
        CS[create-session]
        RUN[run-session]
    end

    CL --> RC --> CS
    CS --> RUN
    RS --> T --> S --> SUB --> B --> BR --> I --> P --> C
    P -. "no → goto" .-> T
    RS -.uses.-> SP
    RS -.uses.-> SD
    RS -.uses.-> DS
```

## API

| Export                 | Description                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `createAuthorSession`  | Build a session from a partial config (steps default to `conventionalPreset`)                                                     |
| `runAuthorSession`     | Execute the session; returns `{ status: 'committed' \| 'cancelled', message? }`                                                   |
| `loadCommitConfig`     | Discover `commit.config.{js,mjs,cjs}` upward from `cwd`                                                                           |
| `resolveSessionConfig` | Overlay a partial config on the built-in defaults                                                                                 |
| `conventionalPreset`   | Default ordered step list (D8)                                                                                                    |
| Individual steps       | `resolveScopeStep`, `typeStep`, `scopeStep`, `subjectStep`, `bodyStep`, `breakingStep`, `issuesStep`, `previewStep`, `commitStep` |
| `SessionConfig`        | Fully resolved config type consumed by the runner                                                                                 |
| `SessionContext`       | Mutable container threaded through every step                                                                                     |

## Configuration

The `commit.config.{js,mjs,cjs}` file exports a `PartialSessionConfig`:

```javascript
// commit.config.cjs
module.exports = {
  types: [
    { name: 'feat', description: 'A new feature' },
    { name: 'fix', description: 'A bug fix' },
  ],
  scopeMulti: false,
  scopeOptional: false,
  // Filter discovered projects; receives { path, name } per candidate
  scopeFilter: ({ path }) => !path.includes('/__fixtures__/'),
  headerMaxLength: 72,
  // Ruleset reused by the `cl` validator bin and the preview step
  validateRuleset: {
    'type-enum': ['error', { types: ['feat', 'fix', 'docs', 'chore'] }],
    'subject-empty': ['error'],
    'header-max-length': ['warn', { maxLength: 72 }],
    'imperative-mood': ['warn'],
  },
  skipCommit: false,
}
```

Key fields:

| Field             | Behaviour                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `types`           | Conventional types shown in the `type` step (falls back to the 11-entry Conventional list) |
| `scopeFilter`     | Exclude discovered projects from the scope picker by `path`/`name`                         |
| `headerMaxLength` | Drives the live countdown in the `subject` step (green → yellow → red); `null` disables    |
| `validateRuleset` | Shared with `cl` and the preview step; see `commits/validate` presets                      |
| `skipCommit`      | When true, the session returns the formatted message without touching the git index        |
| `commitExecutor`  | Inject a custom executor (e.g. signed commits, alternate cwd) instead of the default       |

Resolution:

1. `--config <path>` override (relative paths resolve against `cwd`)
2. Walk upward from `cwd` looking for one of `commit.config.{js,mjs,cjs}`
3. Stop at a workspace boundary (`.git/`, `pnpm-workspace.yaml`)

## Usage

```typescript
import { createAuthorSession, runAuthorSession } from '@hyperfrontend/versioning/commits/author'

const session = createAuthorSession({ config: { skipCommit: false } })
const outcome = await runAuthorSession(session)

if (outcome.status === 'committed') {
  console.log('Committed:', outcome.message)
} else {
  console.error('Cancelled:', outcome.error?.message ?? '<user abort>')
  process.exit(130)
}
```

## Design Decisions

- **D8** — Step order: `resolve-scope → type → scope → subject → body → breaking → issues → preview → commit`
- **D15c** — Commit execution is default-on; inject `skipCommit` / `commitExecutor` to override
- **D17a** — Config file lives at workspace root (not in `package.json`)
- **E1a** — Empty staging refuses with an error; bins translate that to a non-zero exit code
