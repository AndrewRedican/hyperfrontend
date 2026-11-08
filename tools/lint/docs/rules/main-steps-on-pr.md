# main-steps-on-pr

Every step the main workflow runs on each leg, a pull request runs first.

## Rule Details

This rule runs on `.github/workflows/ci-main.yml`. It reads the named steps of its `environment` job, the job each leg (Linux, Windows, macOS) runs, and the named steps of the `environment` job of `ci-pr.yml` beside it. A step the main workflow has and the pull-request workflow lacks is reported at its name, unless the `mainOnly` option lists it.

A check that only main runs meets its first run after the merge, and a main run that fails publishes nothing: the Linux publishes wait for the Windows and macOS legs to succeed. A step belongs in `mainOnly` only when it publishes, or reports what main published, and so has nothing to check on a pull request.

The rule also reports a `mainOnly` entry that names no step of the main workflow's environment job, and one the pull-request workflow runs too, so the list never outlives the steps it excuses.

Steps are matched by name. Two steps with one name and different commands are not compared; keep a step's commands the same in both workflows, or give the main one its own name.

## Options

| Option     | Type       | Description                                   |
| ---------- | ---------- | --------------------------------------------- |
| `mainOnly` | `string[]` | The names of the steps that run on main alone |

## Examples

### ❌ Incorrect

A check added to the main workflow only:

```yaml
# ci-main.yml
environment:
  steps:
    - name: Checkout
    - name: Command line through PowerShell
    - name: Run
```

```yaml
# ci-pr.yml
environment:
  steps:
    - name: Checkout
    - name: Run
```

### ✅ Correct

The check runs in both workflows, and the publishing step is listed:

```ts
// lint.config.ts
{
  files: ['.github/workflows/ci-main.yml'],
  rules: { 'workspace/main-steps-on-pr': ['error', { mainOnly: ['npm auth'] }] },
}
```

```yaml
# ci-main.yml
environment:
  steps:
    - name: Checkout
    - name: npm auth
    - name: Command line through PowerShell
    - name: Run
```

```yaml
# ci-pr.yml
environment:
  steps:
    - name: Checkout
    - name: Command line through PowerShell
    - name: Run
```

## When Not To Use It

- If the main workflow has no pull-request counterpart, or the two do not share an `environment` job

## Related Rules

- [lib-ci-workflows](./lib-ci-workflows.md) - Wires every publishable library into the main workflow
