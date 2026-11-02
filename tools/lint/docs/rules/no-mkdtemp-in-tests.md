# no-mkdtemp-in-tests

Create a test's temporary directories with `@hyperfrontend/testing/fs` rather than `mkdtemp`.

## Rule Details

Specs and their `__test-utils__` modules that need files on disk take a directory from
`createTempDir` or `useTempDir`. Both resolve the directory's real path, write a declared tree into
it, and remove it, retrying while Windows still holds a handle open; `useTempDir` also registers the
hooks that give every test a fresh directory. A hand-rolled `mkdtempSync`, a `write` helper and a
final `rmSync` repeat that in every file, and usually skip the parts that only matter on macOS or
Windows.

The rule reports:

- a named `mkdtemp` or `mkdtempSync` import, renamed or not, from `node:fs`, `fs`,
  `node:fs/promises` or `fs/promises`;
- `mkdtemp` or `mkdtempSync` read, dotted or bracketed with a string literal, off a namespace or
  default import of one of those modules.

A namespace import of `node:fs` used for anything else, such as a spy, is left alone, as are names
from any other module, objects no fs import bound, and a mocked `node:fs`. `require` calls are not
read. The rule does not fix: choosing between a module-level `createTempDir` and a per-test
`useTempDir` decides when the directory is created and removed, which only the spec's author knows.

### Why?

- **One cleanup that works everywhere.** The helpers remove the directory with retries, which a
  Windows run needs and a local Linux run never shows.
- **Real paths.** On macOS the temporary directory is a symbolic link; the helpers return the
  resolved path, so a path the code under test resolves compares equal to the one the spec holds.
- **Less scaffolding.** A tree passed as data replaces the `mkdirSync` and `writeFileSync` loop each
  spec otherwise writes for itself.

## Options

None.

## Examples

### ❌ Incorrect

```typescript
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const ROOT = mkdtempSync(join(tmpdir(), 'lint-paths-'))
mkdirSync(join(ROOT, 'libs/a'), { recursive: true })
writeFileSync(join(ROOT, 'libs/a/project.json'), '{ "name": "lib-a" }')
```

**Error**: `Create a test's temporary directory with createTempDir or useTempDir from '@hyperfrontend/testing/fs' rather than 'mkdtempSync': they resolve its real path and remove it for you.`

### ✅ Correct

```typescript
import { createTempDir } from '@hyperfrontend/testing/fs'

const DIR = createTempDir({ prefix: 'lint-paths-', tree: { 'libs/a/project.json': '{ "name": "lib-a" }' } })
```

```typescript
import { useTempDir } from '@hyperfrontend/testing/fs'

describe('loadConfig', () => {
  const dir = useTempDir()

  it('reads the config beside the manifest', () => {
    dir.write('hf.config.json', '{ "strict": true }')
    expect(loadConfig(dir.path)).toEqual({ strict: true })
  })
})
```

## Configuration

Enabled from `lint.base.config.ts` for specs, `__test-utils__` modules and the package e2e suites'
`support` modules. `libs/testing`, which implements the helpers, and the docs site, whose specs run
under Vitest, switch it off in their own `lint.config.ts`:

```js
{
  files: ['**/*.spec.{ts,tsx,mts,cts}', '**/__test-utils__/**/*.{ts,tsx,mts,cts}', 'apps/package-e2e/*/src/support/**/*.ts'],
  rules: {
    'workspace/no-mkdtemp-in-tests': 'error',
  },
}
```

## Related Rules

- [no-signal-kill-in-tests](./no-signal-kill-in-tests.md): the other helper of `@hyperfrontend/testing`
  a spec reaches for instead of the raw Node call
- [no-test-fixtures](./no-test-fixtures.md): test material is written to a temporary directory
  while a spec runs, never kept as files at rest
