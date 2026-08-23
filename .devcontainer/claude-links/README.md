# Claude Code state, linked into the workspace

`_/claude/` is a set of symlinks to state that lives outside the repo. Nothing is
copied, so nothing goes stale. `_` is gitignored, so none of it reaches git.

VS Code only resolves links to paths inside the workspace, which is the point:
an absolute path into `/tmp` or `~/.claude` is a dead click in the editor, and a
path under `_/claude/` is not.

| Link                   | Points at                             | Holds                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scratch`              | `/tmp/claude-<uid>/<workspace-slug>`  | One dir per session: `scratchpad/` (scripts, screenshots) and `tasks/` (background command output). **Ephemeral: wiped on a session-limit reset.**                                                           |
| `sessions`             | `~/.claude/projects/<workspace-slug>` | This project's durable state: one `<uuid>.jsonl` transcript per session, plus a `<uuid>/` dir per session holding whatever Claude was told to keep (briefs, recon, workflow journals, subagent transcripts). |
| `memory`               | `.../<workspace-slug>/memory`         | The persistent memory files and `MEMORY.md`, the index loaded into every session.                                                                                                                            |
| `all-projects`         | `~/.claude/projects`                  | The same, for every repo Claude has worked on in this container.                                                                                                                                             |
| `file-history`         | `~/.claude/file-history`              | Snapshots of files Claude edited, for recovering an overwrite.                                                                                                                                               |
| `user-settings.json`   | `~/.claude/settings.json`             | User-level config: permissions, hooks, env.                                                                                                                                                                  |
| `latest-scratch`       | newest dir under `scratch`            | Shortcut past the UUID. Regenerate with `refresh`.                                                                                                                                                           |
| `latest-session`       | newest dir under `sessions`           | Same, for durable session state.                                                                                                                                                                             |
| `refresh`, `README.md` | this directory                        | Links back to the tracked sources, so editing them from `_/claude/` edits the real file.                                                                                                                     |

Not linked: `~/.claude/.credentials.json` and the rest of `~/.claude`, deliberately.
Repo-level Claude config is already in the workspace at `.claude/` (skills, project settings).

## Rebuilding after a fresh container

The links live under `_`, which git never sees, so a new codespace starts without
them. `postCreateCommand` runs the setup for you; to do it by hand, or after
moving the checkout:

```bash
bash .devcontainer/claude-links/setup.sh
```

It is idempotent: it repoints links whose target moved, creates any missing
directory so no link dangles on a fresh box, and leaves alone anything in
`_/claude/` that is not a symlink it made. Both the workspace slug and the uid
are derived at run time, so a different checkout path or user works unchanged.

## Keeping the shortcuts current

Session dirs are named by UUID, so `latest-scratch` and `latest-session` are the
only sane entry points. They are plain symlinks and go stale as soon as a new
session starts:

```bash
_/claude/refresh
```

## Watch out for

- **Transcripts are big.** `sessions` runs to hundreds of MB and `all-projects`
  more, mostly `*.jsonl`, several files over 25MB. Opening one in the editor is
  slow. They are excluded from the file watcher in `devcontainer.json`, and
  search skips gitignored paths by default.
- **`scratch` is not durable.** Anything worth keeping should be moved into
  `sessions/<uuid>/` or into the repo.
