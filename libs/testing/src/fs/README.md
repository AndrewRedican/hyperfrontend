# fs

Temporary directories that delete themselves, and fixture trees written into them from data the spec declares.

## Usage

[`useTempDir`](https://www.hyperfrontend.dev/docs/libraries/testing/fs/#api-useTempDir) registers the `node:test` hooks that give every test in the suite a fresh directory and delete it afterwards. The handle it returns always points at the current test's directory, so capture it once in the [`describe`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-describe) body:

```typescript
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { loadConfig } from './load-config'

describe('loadConfig', () => {
  const dir = useTempDir({
    tree: {
      'package.json': { name: 'app' },
      'src/index.ts': 'export const ready = true\n',
    },
  })

  it('reads a config file beside the manifest', () => {
    dir.write('hf.config.json', { strict: true })
    expect(loadConfig(dir.path)).toEqual({ strict: true })
  })
})
```

Pass `scope: 'all'` to share one directory across the suite instead. For a directory a single test owns, [`createTempDir`](https://www.hyperfrontend.dev/docs/libraries/testing/fs/#api-createTempDir) creates it straight away and leaves removal to the caller: a matching [`after`](https://nodejs.org/api/test.html#afterfn-options) hook at module or suite scope, or a `finally` inside the one test that owns it. [`writeTree`](https://www.hyperfrontend.dev/docs/libraries/testing/fs/#api-writeTree) and [`writeFile`](https://www.hyperfrontend.dev/docs/libraries/testing/fs/#api-writeFile) write into any directory you already have.

## File content

A [`FileTree`](https://www.hyperfrontend.dev/docs/libraries/testing/fs/#api-FileTree) maps relative paths to content. Parent directories are created as needed.

| Value           | Written as                                |
| --------------- | ----------------------------------------- |
| A string        | The text, unchanged                       |
| A `Uint8Array`  | The bytes, unchanged                      |
| Any other value | Pretty-printed JSON followed by a newline |

## Design

Fixtures held as data in the spec, rather than checked in as files, never look like a real manifest or lockfile to a dependency scanner, and the spec states every file it depends on.

The directory's path is reported with symbolic links resolved. On macOS the system temporary directory is a symbolic link, and on Windows it can be an 8.3 short name, so an unresolved path would differ from what `process.cwd()` or a resolved real path report inside the code under test. Writes refuse a path that is absolute or climbs out of the directory, since anything written there would survive the cleanup. Removal retries while Windows still holds a handle open inside the directory.
