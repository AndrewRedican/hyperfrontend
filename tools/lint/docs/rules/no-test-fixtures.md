# no-test-fixtures

Keep test material in code rather than in files at rest.

## Rule Details

A spec's inputs (sample manifests, configuration files, source trees, expected outputs) are held as
strings or objects in a `__test-utils__` module. A spec hands them to the code under test as text,
or, when that code needs a path, writes them to a temporary directory while it runs and removes it
afterwards:

```typescript
// src/__test-utils__/sample-workspace.ts
const FILES: Readonly<Record<string, string>> = {
  'alpha/project.json': '{\n  "name": "alpha"\n}\n',
  'alpha/src/index.ts': 'export {}\n',
}

export function writeSampleWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'sample-workspace-'))
  for (const [path, text] of entries(FILES)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  after(() => rmSync(root, { recursive: true, force: true }))
  return root
}
```

The rule reports three kinds of entry anywhere in the workspace:

- **A directory named for test material.** Its name is compared with case, underscores, hyphens and
  dots dropped, so `__fixtures__`, `fixtures`, `Fixture`, `test-fixtures`, `testdata`, `test_data`,
  `test-files`, `test-inputs`, `test-assets`, `golden`, `goldens` and `golden-files` all count, as
  does the snapshot directory `__snapshots__`. A reported directory is not entered.
- **A file named as test material.** A name with a `fixture`, `fixtures` or `golden` segment between
  dots, as in `user.fixture.json` or `parse.golden.txt`, or ending in `.snap` or `.golden`.
- **A file other than a code module inside `__test-utils__`.** The directory holds `.ts`, `.tsx`,
  `.mts`, `.cts`, `.js`, `.jsx`, `.mjs` and `.cjs` files only, so a `package.json` or a `.tree`
  output kept there is reported however it is named.

A code module is never reported for its name alone: `test-fixtures.ts` exporting sample data is test
material written as code, which is what the rule asks for.

The rule runs once, from the workspace's root `package.json`: a `package.json` anywhere else returns
immediately. The walk never descends into `node_modules`, `.git`, `dist`, `coverage`, `tmp`, `out`,
`.next`, `.nx`, `.angular`, `.verdaccio`, `.claude` or `_`.

### Why?

- **Files at rest look real.** A sample `package.json` or lockfile is indistinguishable from a real
  one to anything that scans the repository. Dependency scanners raised security alerts against
  sample manifests that declared versions no build ever installed, and dismissing them did not stop
  them coming back.
- **Lint and format ignores follow them.** Inputs shaped to trip a rule or a parser have to be
  excluded from linting, formatting, coverage, type checking and the build, one configuration at a
  time, and every exclusion is a place where real code can hide.
- **A spec reads whole.** Data held beside the spec that uses it is found by following an import,
  not by matching a directory listing against expected-output files by name.

### Trade-off

Writing a tree to a temporary directory costs a few milliseconds per spec file, and data that
contains backslashes, backticks or carriage returns has to be escaped in a template literal. Both
are cheaper than a repository whose sample files are mistaken for its own.

## Options

None.

## Examples

### ❌ Incorrect

```text
libs/my-lib/__fixtures__/minimal-project/package.json
libs/my-lib/src/parse/testdata/input.md
libs/my-lib/src/__test-utils__/expected.tree
```

**Error**: `Test material belongs in code, not in files at rest. Found 'libs/my-lib/__fixtures__', a directory named for test material: hold its contents in a __test-utils__ module and hand them to the spec as text, or write them to a temporary directory while it runs.`

### ✅ Correct

```text
libs/my-lib/src/__test-utils__/sample-projects.ts     ← the trees as strings
libs/my-lib/src/__test-utils__/write-samples.ts       ← writes them to a temporary directory
```

## Configuration

Enabled from the root `lint.config.ts`:

```js
{
  files: ['**/package.json'],
  rules: {
    'workspace/no-test-fixtures': 'error',
  },
}
```

## Related Rules

- [no-vscode-config](./no-vscode-config.md): the other check that sweeps the workspace from its root
  manifest
