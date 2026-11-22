---
name: commit-messages
description: Write conventional commits for the hyperfrontend monorepo — types, scopes (project.json names), one-line subjects, atomic commits, versioning-harness boundaries. Use when committing, splitting work into commits, choosing a commit scope/type, or asked about commit format.
---

# Commit Messages

Format: `type(scope): subject` — one line, lowercase subject, no period, imperative mood.

## Paths

| Role                       | Where                                                                           |
| -------------------------- | ------------------------------------------------------------------------------- |
| Message lint (`npx cl`)    | `libs/versioning/src/bin/cl.ts` (runs in `commit-msg` hook)                     |
| Guided prompt (`npx cz`)   | `libs/versioning/src/bin/cz.js`                                                 |
| Type list + bump semantics | `libs/versioning/src/commits/models/commit-type.ts`                             |
| Scope filtering            | `hf.json` → `targetDefaults.version.options.scopeFiltering`                     |
| Hooks                      | `hooks.config.ts` (pre-commit format, commit-msg cl, pre-push gates, push bump) |

## Types

`feat` `fix` `security` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`

Version impact (computed by `npx hf push` through the root `version:all` target, never by hand; pre-push only checks it): `feat` → minor · `fix`/`security`/`perf`/`revert` → patch · `!` or `BREAKING CHANGE:` footer → major (minor while the package major is 0). Other types never bump. A releasable commit also patch-bumps every library that ships a copy of the code it changes, and one to the builder modules that shape a tarball (the `toolchain` named input in `hf.json`) or to the package build executor patch-bumps every library.

**Unreleased code**: a correction to code that no release has shipped is never `fix`, since no consumer met the bug: type it `refactor`, `chore` or whatever else fits (`test`, `docs`, `ci`); the subject may still say it fixes something.

**`security`**: a dependency change made for a security reason is `security(<project>)`, whatever the size of the bump; it is listed under "Security" in the changelog. It carries `!` when it breaks public API, and a change that adds public API is a `feat`. A fix made only in the root manifest or lock is `security(hyperfrontend)`, which releases nothing, like every root-scoped commit.

## Scopes

**A scope MUST be a project name exactly as written in that project's `project.json` `name` field.**

```bash
npx hf show projects | grep <hint>   # verify before committing
```

✓ `lib-features` `lib-nexus` `e2e-lib-features` `demo-clock` `docs-site` `tool-app`
✗ `package-e2e` `features` `nexus` (directory names, npm names — not project names)

Workspace-level changes (nothing project-owned) use one of the versioning-excluded scopes — these never trigger a bump: `hyperfrontend` (the root project) · `repo` · `ci` · `deps` · `release`.

One project per commit. Touching two projects = two commits (see Atomic).

## Subject

- Concise one-liner stating **what**, not why: `fix(lib-nexus): deliver messages between real broker windows`
- No body. A body is an extreme exception (e.g. a wire-format break needing a `BREAKING CHANGE:` footer) — never used to over-explain reasoning.
- No AI attribution lines, no co-author trailers.

## Atomic

Each commit is self-contained: it compiles, its tests pass, and it makes one logical change. Split by concern, order foundation → dependent. Never bundle unrelated fixes because they share a file-save.

## Committing

- `git commit -m "type(scope): subject"` or `npx cz` — both fine when the message meets the rules above.
- **`--no-verify` is forbidden.** Hooks are the contract: pre-commit formats (auto-stages fixes), commit-msg runs `cl`, pre-push runs the binary budget, the audit, the version check and the pipeline (typecheck/lint/test/build/e2e).
- **Push with `npx hf push`**: it runs the root `version:all` target, commits the bump and pushes. A plain `git push` is refused while a bump is due. A clone skips a pre-push step in its untracked `hooks.local.config.ts`; never by editing `hooks.config.ts`.

## Never commit by hand

The versioning harness owns these — committing them manually corrupts the release flow (when in doubt read `libs/versioning/README.md` + the `version`/`version-check` target defaults in `hf.json`):

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
