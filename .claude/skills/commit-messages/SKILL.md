---
name: commit-messages
description: Write conventional commits for the hyperfrontend monorepo — types, scopes (Nx project names), one-line subjects, atomic commits, versioning-harness boundaries. Use when committing, splitting work into commits, choosing a commit scope/type, or asked about commit format.
---

# Commit Messages

Format: `type(scope): subject` — one line, lowercase subject, no period, imperative mood.

## Paths

| Role                       | Where                                                             |
| -------------------------- | ----------------------------------------------------------------- |
| Message lint (`npx cl`)    | `libs/versioning/src/bin/cl.ts` (runs in `commit-msg` hook)       |
| Guided prompt (`npx cz`)   | `libs/versioning/src/bin/cz.js`                                   |
| Type list + bump semantics | `libs/versioning/src/commits/models/commit-type.ts`               |
| Scope filtering            | `nx.json` → `targetDefaults.version.options.scopeFiltering`       |
| Hooks                      | `lefthook.yml` (pre-commit format, commit-msg cl, pre-push gates) |

## Types

`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`

Version impact (computed at pre-push by `nx version:all` — never by hand): `feat` → minor · `fix`/`perf`/`revert` → patch · `!` or `BREAKING CHANGE:` footer → major (minor while the package major is 0). Other types never bump.

## Scopes

**A scope MUST be an Nx project name exactly as written in that project's `project.json` `name` field.**

```bash
npx nx show projects | grep <hint>        # verify before committing
```

✓ `lib-features` `lib-nexus` `e2e-lib-features` `demo-clock` `docs-site` `tool-app`
✗ `package-e2e` `features` `nexus` (directory names, npm names — not project names)

Workspace-level changes (nothing project-owned) use one of the versioning-excluded scopes — these never trigger a bump: `@hyperfrontend/workspace` (docs/roadmap precedent) · `repo` · `ci` · `deps` · `release`.

One project per commit. Touching two projects = two commits (see Atomic).

## Subject

- Concise one-liner stating **what**, not why: `fix(lib-nexus): deliver messages between real broker windows`
- No body. A body is an extreme exception (e.g. a wire-format break needing a `BREAKING CHANGE:` footer) — never used to over-explain reasoning.
- No AI attribution lines, no co-author trailers.

## Atomic

Each commit is self-contained: it compiles, its tests pass, and it makes one logical change. Split by concern, order foundation → dependent. Never bundle unrelated fixes because they share a file-save.

## Committing

- `git commit -m "type(scope): subject"` or `npx cz` — both fine when the message meets the rules above.
- **`--no-verify` is forbidden.** Hooks are the contract: pre-commit formats (auto-stages fixes), commit-msg runs `npx cl`, pre-push runs typecheck/lint/test/build/e2e + `nx version:all`.

## Never commit by hand

The versioning harness owns these — committing them manually corrupts the release flow (when in doubt read `libs/versioning/README.md` + the `version`/`version-check` target defaults in `nx.json`):

- `CHANGELOG.md` files
- `package.json` `version` fields (any project)
- Git tags (`lib-<name>@<version>`)
- e2e target-project version refs (harness emits per-project `chore(e2e-lib-<name>): update target project version`)

## Checklist

- [ ] Scope is a `project.json` name (or a sanctioned workspace scope)
- [ ] Type matches the change; `!`/footer only for real breaks
- [ ] One line, imperative, lowercase, no period, no body
- [ ] Commit is atomic and self-contained
- [ ] No version/changelog/tag files staged
- [ ] No `--no-verify`
