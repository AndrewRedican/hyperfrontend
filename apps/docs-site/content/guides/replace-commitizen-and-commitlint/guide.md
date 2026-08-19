# How to replace commitizen and commitlint with one package

You will drop four packages and both of their configs, and keep the same workflow: a guided prompt for writing conventional commits, and a hook that refuses the ones that do not conform.

`commitizen`, `cz-conventional-changelog`, `@commitlint/cli`, and `@commitlint/config-conventional` split one concern across two toolchains that have to be kept agreeing with each other. [`@hyperfrontend/versioning`](/docs/libraries/versioning) ships both halves as the [`cz` and `cl` bins](/docs/libraries/versioning/bin), reading one config file, with no runtime dependencies of its own.

## 1. Swap the packages

```bash
npm uninstall commitizen cz-conventional-changelog @commitlint/cli @commitlint/config-conventional
npm install --save-dev @hyperfrontend/versioning
```

Delete `commitlint.config.js`, and the `.czrc` or `config.commitizen` block that pointed commitizen at its adapter. The `"commit": "cz"` script can go too, because `npx cz` runs on its own.

## 2. Put both configs in one file

`commit.config.js` at the repo root feeds the prompt and the validator from a single source, so a type you offer is always a type you accept:

```js
/** @type {import('@hyperfrontend/versioning/commits/author').PartialSessionConfig} */
module.exports = {
  types: [
    { name: 'feat', description: 'A new feature' },
    { name: 'fix', description: 'A bug fix' },
    { name: 'docs', description: 'Documentation only' },
    { name: 'chore', description: 'Tooling and housekeeping' },
  ],
  scopeOptional: true,
  headerMaxLength: 72,
  validateRuleset: {
    'type-enum': ['error', { types: ['feat', 'fix', 'docs', 'chore'] }],
    'subject-empty': ['error'],
    'header-max-length': ['error', { maxLength: 72 }],
    'imperative-mood': ['warn'],
  },
}
```

[`validateRuleset`](/docs/libraries/versioning/commits/validate#api-Ruleset) maps a rule name to a [`[level]` or `[level, options]` tuple](/docs/libraries/versioning/commits/validate#api-RuleConfig), where the level is `error`, `warn`, or `off` and anything unlisted is off. The rules are `type-enum`, `scope-enum`, `subject-empty`, `subject-case`, `header-max-length`, and `imperative-mood`. `.mjs` and `.cjs` work the same way, and `--config <path>` overrides discovery.

The rest of [`PartialSessionConfig`](/docs/libraries/versioning/commits/author#api-PartialSessionConfig) shapes the session: `scopeMulti` to collect several scopes, and `scopeFilter` to drop candidates by `{ path, name }`.

## 3. Author commits with `cz`

```bash
git add .
npx cz
```

The session walks type, scope, subject, body, breaking change, issue references, then a preview you confirm before it runs `git commit`. The subject step counts down the characters left in the header budget as you type, and the same ruleset warns inline, so a message that would fail the hook is visible before you reach it.

Scope choices come from what you staged: each staged path resolves to its nearest project, and those project names become the list. Stage inside one package and that package is the only offer; stage nothing and the session stops and tells you to stage first. Cancelling with `Ctrl+C` exits `130` and writes nothing.

## 4. Enforce it in the `commit-msg` hook

`cl` takes the path git hands the hook and exits non-zero on any error-level violation, which is exactly the contract [husky](https://typicode.github.io/husky/) and [lefthook](https://lefthook.dev/) already expect.

`.husky/commit-msg`:

```bash
npx cl "$1"
```

Or in `lefthook.yml`:

```yaml
commit-msg:
  commands:
    validate:
      run: npx cl {1}
```

Warnings print and let the commit through; errors print and stop it:

```text
✖ type-enum: type must be one of [feat, fix, docs, chore] but was "added"
```

## 5. Run the same check on a pull request

A hook only protects the machines that installed it. Validate every commit on the branch in CI, using the same config file:

```yaml
- run: |
    status=0
    for sha in $(git rev-list ${{ github.event.pull_request.base.sha }}..HEAD); do
      git log -1 --format=%B "$sha" > "$RUNNER_TEMP/commit-msg"
      npx cl "$RUNNER_TEMP/commit-msg" || status=1
    done
    exit $status
```

## Check it worked

Commit a message that breaks a rule you set to `error` and watch the hook reject it by name. Commit a conforming one and watch it land. Then run `npx cz` on a staged change: the type list is the one from your config, the scope offered matches the package you staged in, and the header countdown starts at your `headerMaxLength`.
