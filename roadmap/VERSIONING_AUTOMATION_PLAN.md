# Versioning Automation

**Status**: Core implementation complete. Pending testing and fixes.

---

## Remaining Work

See [SEMVER_INTEGRATION_ANALYSIS.md](./SEMVER_INTEGRATION_ANALYSIS.md) for detailed analysis of critical issues.

| Issue                 | Severity  | Description                                           |
| --------------------- | --------- | ----------------------------------------------------- |
| Tag creation          | 🔴 High   | `--skipTag` prevents tags from being created          |
| Output parsing        | 🔴 High   | Post-commit script parses non-matching output strings |
| Missing `--skipStage` | 🟡 Medium | Semver may stage files unexpectedly during hooks      |

### Testing Needed

- [ ] Test local workflow end-to-end
- [ ] Test PR workflow end-to-end with tags
- [ ] Verify publish works after PR merge

---

## How It Works

```
Developer commit → post-commit hook → version + CHANGELOG updated → push to PR
                                                                          ↓
                                                    CI validates + fallback versioning
                                                                          ↓
                                                    PR merged → ci-release publishes
```

The idempotent version executor (`@hyperfrontend/package:version`) wraps `@jscutlery/semver:version`:

- Checks if current version is already tagged → skips (idempotent)
- Otherwise delegates to semver for version bump + CHANGELOG

---

## Key Files

| File                                    | Purpose                     |
| --------------------------------------- | --------------------------- |
| `tools/package/src/executors/version/`  | Idempotent version executor |
| `tools/scripts/post-commit-version.mjs` | Post-commit hook script     |
| `lefthook.yml`                          | Git hooks config            |
| `.github/workflows/ci-pr.yml`           | PR validation + fallback    |
| `.github/workflows/ci-release.yml`      | Publish on PR merge         |

---

## Related

- [SEMVER_INTEGRATION_ANALYSIS.md](./SEMVER_INTEGRATION_ANALYSIS.md) — Critical issues to fix
- [BUILD_SYSTEM_PROGRESS.md](./BUILD_SYSTEM_PROGRESS.md) — Build architecture
- [DEPLOYMENT_PUBLISHING.md](./DEPLOYMENT_PUBLISHING.md) — Publishing workflow
