# How to release libraries from their commits

You will be able to bump a library's version, write its changelog and commit the release from the commits that changed it, and have CI refuse a push whose versions do not match those commits. Nobody picks a version number.

[`@hyperfrontend/workspace`](/docs/libraries/workspace) reads [conventional commits](https://www.conventionalcommits.org/) through [`@hyperfrontend/versioning`](/docs/libraries/versioning), with the npm registry as the record of what is already published.

## 1. Make the library publishable

```bash
npx hf generate make-publishable format
```

This gives the library its `version`, `version-check` and `publish` targets, the manifest fields a registry asks for, and an e2e project that tests the packed package.

## 2. Scope each commit with the project's name

The scope is the project name as its `project.json` writes it, not the package name:

```bash
git commit -m "feat(format): format byte counts"
```

| Commit                                              | Bump                                          |
| --------------------------------------------------- | --------------------------------------------- |
| `fix(...)`, `perf(...)`, `revert(...)`              | patch                                         |
| `feat(...)`                                         | minor                                         |
| `feat(...)!`, or a `BREAKING CHANGE:` footer        | major; minor while the version is below 1.0.0 |
| `docs(...)`, `chore(...)`, `test(...)` and the rest | none                                          |

A commit without a scope counts for every library whose files it touches.

## 3. Check the versions in CI

```bash
npx hf run format:version-check
```

The check writes nothing. Before the release it fails and names the remedy:

```text
❌ format: version mismatch
Expected: 0.1.0 (MINOR bump from 2 commit(s))
Actual:   0.0.0
```

Run it in CI with the full history, since the check reads the commits:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- run: npm ci
- run: npx hf affected -t version-check
```

## 4. Version the library

```bash
npx hf run format:version
```

It sets `version` in `package.json`, writes the `CHANGELOG.md` entry, brings every workspace project that depends on the package to the new version, and commits:

```text
chore(format): release version 0.1.0
```

Run it with `--dryRun` to print the bump and write nothing. The release commit is recognised on the next run, so running `version` again changes nothing.

To version every library a branch changed in one commit, give the root project a target that runs [`version-batch`](/docs/libraries/workspace/executors/version-batch), and run it before you push:

```json
{
  "targets": {
    "version:all": {
      "executor": "@hyperfrontend/workspace:version-batch",
      "options": { "base": "origin/main" }
    }
  }
}
```

## 5. Publish

```bash
npx hf run-many -t publish -p format --dryRun
```

`run-many` runs the `build` the `publish` target depends on, then previews what npm would upload. In CI, with `NPM_TOKEN` set, drop `--dryRun`. A version the registry already has is skipped, so the publish job can run on every merge.

## Check it worked

`npx hf run format:version-check` exits 0, `libs/format/package.json` holds the new version, `libs/format/CHANGELOG.md` lists the commits under it, and `git log -1` shows the release commit.
