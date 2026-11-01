# cross-platform

Keep publishable libraries, and any other files the `include` option selects, working on Windows: path separators, absolute-path tests, file paths used as module specifiers, `.cmd` shims, and CRLF text.

## Rule Details

The libraries are developed and tested on Linux, but many consumers run them on Windows, and so will a Windows CI leg running the workspace tooling. Most Windows breakage sits where a string crosses between two separator conventions, so the rule tracks where each string value comes from and reports only the crossings.

| Domain   | Separator              | Produced by                                                                                                                                                                                                                                                                        |
| -------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| native   | `sep` (`\` on Windows) | `node:path` `join`, `resolve`, `normalize`, `dirname`, `format`, `toNamespacedPath`; `process.cwd()`; `tmpdir()`, `homedir()`; `fileURLToPath()`; `realpathSync()`, `mkdtempSync()`; `require.resolve()`; `__dirname`, `__filename`; `import.meta.dirname`, `import.meta.filename` |
| relative | `sep`                  | `node:path` `relative()`                                                                                                                                                                                                                                                           |
| portable | always `/`             | `node:path/posix` and `posix.*`; string literals; the portable helpers of `@hyperfrontend/project-scope/core/path`; `x.split(sep).join(posix.sep)`; templates and concatenations of portable parts; strings starting `./` or `../`                                                 |
| unknown  | could be either        | parameters, imports from other modules, destructured values, anything else                                                                                                                                                                                                         |

The rule follows `const` initialisers, single-assignment `let`, conditionals, `||` and `??` fallbacks, templates, `+` chains, and the string methods `slice`, `substring`, `trim*`, and `toLowerCase`. It stops after eight variable hops.

### Two levels of confidence

- **Tier 1, proven native.** The value's origin is one of the native sources above. The rule reports it with an autofix in the native flavour.
- **Tier 2, named like a path.** The origin is unknown, but the value is reached through a name whose last word is `path`, `dir`, `directory`, `root`, `file`, `folder`, `cwd`, `filename`, or `dirname` (`projectRoot`, `out_dir`, `cwd`), and no earlier word is `url`, `uri`, `href`, `route`, `request`, `req`, `pointer`, `schema`, `ref`, `import`, or `export`. Only the author knows whether such a value is native or portable, so the rule offers two suggestions instead of a fix: treat it as native (`sep`, `join`, `isAbsolute`) or as portable (`posix.sep`, `posix.join`, `posix.isAbsolute`). Tier 2 is active only in projects whose runtime sources import a `node:` module. Choosing the portable suggestion records the decision in the code, and the report does not come back.

Portable values are never reported.

### Why?

- **`/` is not the separator on Windows.** `join('a', 'b')` returns `a\b`, so `split('/')`, `startsWith(`${dir}/`)`, and `${dir}/x` silently stop matching or produce mixed paths.
- **Windows absolute paths start with a drive.** `C:\x` never starts with `/`, and rebuilding a path as `'/' + segments.join('/')` produces `/C:/x`.
- **`relative()` output leaks.** A native relative path stored as an Nx `root`, a map key, or returned data differs per OS, so the same workspace produces different results on Windows.
- **Module specifiers are URLs.** `import('C:\\x\\y.js')` parses `c:` as a URL scheme and fails, and so does the same path given to `node --import`, `--loader`, `--test-reporter`, or `register()`.
- **`URL.pathname` is not a path.** On Windows it is `/C:/x` with percent-encoding.
- **`npm` is a `.cmd` shim on Windows.** Since the fix for CVE-2024-27980, Node refuses to spawn `.cmd` and `.bat` files without a shell (EINVAL), and without one the shim is not found at all (ENOENT). Every launcher in `node_modules/.bin` is the same kind of file.
- **Files checked out with CRLF.** `split('\n')` leaves a trailing `\r` on every line.

## Checks

### `separatorLiteral`

A `/` or `\` matched against a native path by `split`, `indexOf`, `lastIndexOf`, `startsWith`, `endsWith`, `includes`, `replace`, or `replaceAll`, either on the receiver or through an interpolated native value in the argument. Regex arguments are reported when they escape `/` and never `\`.

```typescript
// ❌
const parts = join(root, file).split('/')
if (file.startsWith(`${dirname(root)}/`)) {
}

// ✅
const parts = join(root, file).split(sep)
if (file.startsWith(`${dirname(root)}${sep}`)) {
}
```

### `absoluteCheck`

`startsWith('/')` used to test whether a native path is absolute.

```typescript
// ❌
if (!resolve(input).startsWith('/')) {
}

// ✅
if (!isAbsolute(resolve(input))) {
}
```

### `separatorJoin`

A template or `+` chain that writes `/` next to a native value. Strings starting with `./`, `../`, or `/`, and strings containing whitespace, `://`, `?`, or `#`, are left alone, as are strings named or built from a `url`, `uri`, or `href` value and strings nested inside a larger one. The fix rewrites the string as `join(...)`. When a leading, trailing, or doubled `/` rules that out, it interpolates `sep` instead.

```typescript
// ❌
const manifest = `${projectRoot}/package.json`
const prefix = `${process.cwd()}/`

// ✅
const manifest = join(projectRoot, 'package.json')
const prefix = `${process.cwd()}${sep}`
```

### `relativeEscapes`

A `relative()` result that leaves as data: returned, stored as an object property or array element, assigned to a member, passed to `push`, `unshift`, `add`, `set`, `has`, or `get`, compared with `===` or `!==`, or prefixed with `./`, `../`, or `/` in a template. The rule follows the result through `const` variables and reports once, at the call.

```typescript
// ❌
return { root: relative(workspaceRoot, projectRoot) }

// ✅
return { root: relative(workspaceRoot, projectRoot).split(sep).join(posix.sep) }
```

### `driveLetterLoss`

An absolute path rebuilt as `'/'` followed by joined segments, unless the segments come from a `relative()` result. There is no autofix: walk up with `dirname()` instead of slicing segments.

```typescript
// ❌
for (let i = segments.length; i > 0; i--) {
  const candidate = `/${segments.slice(0, i).join('/')}`
}

// ✅
for (let dir = start; dir !== dirname(dir); dir = dirname(dir)) {
  const candidate = dir
}
```

### `posixConversion`

Any native-to-POSIX conversion except `x.split(sep).join(posix.sep)`: `.replace(/\\/g, '/')`, `.replaceAll('\\', '/')`, `.split('\\').join('/')`, `.split(sep).join('/')`, and `.split('\\').join(posix.sep)`. The other spellings also rewrite backslashes on POSIX, where they are legal file-name characters. Prefer `normalizePath`, `relativePath` and `workspaceRelativePath` from `@hyperfrontend/project-scope/core/path`; the inline spelling is for the few modules that cannot import that package, which carry a local copy marked `portable-path mirror`. Character classes that match either separator, such as `/[\\/]/g`, normalise input whose platform is unknown and are not reported. The autofix applies only in files that already import a `node:` module.

```typescript
// ❌
const specifier = relative(from, to).replace(/\\/g, '/')

// ✅
const specifier = relative(from, to).split(sep).join(posix.sep)
```

### `posixNative`

A native path, or a `relative()` result, given to `basename`, `dirname`, `extname`, `isAbsolute`, `join`, `normalize`, `parse`, `relative`, or `resolve` of `path/posix`. Those functions split on `/` alone, so on Windows `posix.dirname('C:\\x\\y.ts')` answers `.` and `posix.relative('C:\\x', 'C:\\x\\y.ts')` answers a path that climbs out of the drive. Only proven native arguments are reported; a value named like a path may be portable, and `posix.*` is the right call for it then. There is no autofix: either call the `node:path` function, or convert the path first.

```typescript
// ❌
const directory = posix.dirname(join(root, file))

// ✅
const directory = dirname(join(root, file))
const key = workspaceRelativePath(root, join(root, file))
```

### `nativeImport`

A dynamic `import()` of a native path.

```typescript
// ❌
await import(join(distDir, 'index.js'))

// ✅
await import(pathToFileURL(join(distDir, 'index.js')).href)
```

### `nativeSpecifier`

A native path in the other places Node expects a module specifier:

- after `--import`, `--loader`, `--experimental-loader`, or `--test-reporter` in an array literal or in the arguments of `push` and `unshift`;
- interpolated straight after one of those flags, as in `--import=${path}`;
- as the first argument of `register()` from `node:module`.

The fix and the two confidence tiers are the same as for `nativeImport`.

```typescript
// ❌
const hooks = join(root, 'register.ts')
const reporter = join(root, 'reporter.ts')
const argv = ['--import', hooks, `--test-reporter=${reporter}`]
register(join(root, 'hooks.mjs'))

// ✅
const hooks = pathToFileURL(join(root, 'register.ts')).href
const reporter = pathToFileURL(join(root, 'reporter.ts')).href
const argv = ['--import', hooks, `--test-reporter=${reporter}`]
register(pathToFileURL(join(root, 'hooks.mjs')).href)
```

### `urlPathname`

`.pathname` read off `new URL(..., import.meta.url)`, directly or through a variable.

```typescript
// ❌
const here = new URL('.', import.meta.url).pathname

// ✅
const here = fileURLToPath(new URL('.', import.meta.url))
```

### `shellShim`

`execFileSync`, `execFile`, `spawn`, or `spawnSync` from `node:child_process` launching a `.cmd` shim without a `shell` option. The command is recognised as a literal, a `const` holding one, either branch of a conditional, or a value named `packageManager` or `pm`. Calls whose options are not an inline object literal, or that spread their options, are left alone. The suggestion adds `shell: process.platform === 'win32'`, so POSIX keeps spawning the binary directly.

With a shell, Node concatenates the arguments without escaping them and, from Node 24, prints `DEP0190` for every call that passes an argument array. Keep shelled arguments free of spaces and shell metacharacters, or pass the whole command line as one string with no argument array.

```typescript
// ❌
execFileSync('npm', ['pack'], { cwd: packageDir })

// ✅
execFileSync('npm', ['pack'], {
  cwd: packageDir,
  shell: process.platform === 'win32',
})
```

### `binShim`

The same spawn functions launching a file under `node_modules/.bin`, whether the path is built with `join()` or `resolve()`, a template, a `+` chain, or written out, and whether it is passed directly or through a `const`. Those launchers are shell scripts on POSIX and `.cmd` shims on Windows. There is no shell suggestion, because a shell splits an absolute path that contains a space, such as `C:\Users\Jane Doe\repo\node_modules\.bin\tsc`. Run the package's own entry script on the current Node binary instead. Calls that already pass a `shell` option are left alone.

```typescript
// ❌
execFileSync(join(workspaceRoot, 'node_modules', '.bin', 'tsc'), ['--noEmit'])

// ✅
const tscScript = createRequire(join(workspaceRoot, 'package.json')).resolve('typescript/bin/tsc')
execFileSync(process.execPath, [tscScript, '--noEmit'])
```

### `splitCommand`

The same spawn functions launching the first word of a command line split on a space or a regex: `line.split(' ')[0]`, the same through a variable, or the first name of `const [file, ...args] = line.split(' ')`. Whatever the line starts with is launched without a shell, and in practice that is `npm` or `npx`. Run the whole line through a shell, which is also what keeps its quoting intact.

```typescript
// ❌
const [file, ...args] = command.split(' ')
execFileSync(file, args, { cwd })

// ✅
execFileSync(command, { cwd, shell: true })
```

### `lineSplit`

`split('\n')` or `split('\r\n')` on text that may come from a CRLF checkout.

```typescript
// ❌
const lines = content.split('\n')

// ✅
const lines = content.split(/\r?\n/)
```

### `hardcodedTmp`

A string starting with `/tmp`, or exactly `/dev/null`, outside import specifiers, `require` and mock arguments, literal types, and property keys. Exact values get a suggestion.

```typescript
// ❌
const scratch = '/tmp'
spawnSync(command, args, { stdio: ['ignore', '/dev/null', 'inherit'] })

// ✅
const scratch = tmpdir()
spawnSync(command, args, { stdio: ['ignore', devNull, 'inherit'] })
```

### `fileMode`

`.mode` of a `statSync`, `lstatSync` or `fstatSync` result read inside a function, or at the top level, that never mentions `process.platform`. Windows keeps no permission bits: every file reports `0o666`, so a test for an execute bit is false there and an equality with `0o755` never holds.

```typescript
// ❌
expect(statSync(bin).mode & 0o111).not.toBe(0)

// ✅
expect((statSync(bin).mode & 0o111) !== 0).toBe(process.platform !== 'win32')
```

## Fixes and imports

Every fix references `node:` exports the way the file already does: a named import is reused (aliases included), a default or namespace import becomes `path.sep` or `path.posix.sep`, and a missing name is appended to an existing named import or added as a new import where import-order expects it. When a needed name is already taken by something else in scope, the rule reports without a fix. Several fixes in one file each add the same import, so ESLint applies them over successive passes.

## Patterns that are already correct

- Containment test on native paths: compare against `${root}${sep}`, or normalise both sides to POSIX before testing `${base}/`.
- Building a URL from a native relative path: `rel.split(sep).map(encodeURIComponent).join('/')`.
- Building a relative import specifier: `relativePath(from, to)` from `@hyperfrontend/project-scope/core/path`, then prefix `./` when the result does not start with `.`.
- Reporting or storing a path: `workspaceRelativePath(workspaceRoot, path)`, which accepts an absolute or an already relative path and returns the workspace-relative portable form.
- Locating the running module: `fileURLToPath(import.meta.url)` or `__dirname`.
- Importing a file computed at runtime: `import(pathToFileURL(absolutePath).href)`.
- Preloading a file computed at runtime: `['--import', pathToFileURL(absolutePath).href]`.
- Running a dependency's command-line tool: `execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), ...args])`.
- Splitting a path whose platform is unknown: `split(/[/\\]/)`.

## Options

```json
{
  "workspace/cross-platform": [
    "error",
    {
      "helpers": [
        {
          "module": "@hyperfrontend/project-scope/core",
          "native": ["join", "normalizeToNative"],
          "portable": ["joinPath", "normalizePath"]
        }
      ],
      "shimCommands": ["npm", "npx", "pnpm", "yarn"],
      "include": [
        { "publishableLibraries": true },
        {
          "files": ["tools/**", "apps/package-e2e/**"]
        }
      ]
    }
  ]
}
```

### `helpers`

Path helpers outside `node:path` whose output domain the rule should trust. `module` is a bare specifier, or a workspace-relative source path for relative imports, and matches deeper paths too. The defaults cover `@hyperfrontend/project-scope/core` (also as `libs/project-scope/src/core`), where `join` and `normalizeToNative` return native paths and `normalizePath`, `normalizeToForwardSlashes`, `joinPath`, `joinPosix`, `getDirname`, `relativePath`, `workspaceRelativePath`, `resolvePath`, `resolveFromWorkspace`, `resolveRealPath`, and `offsetFromRoot` return portable ones, plus the two dependency-free mirrors: the builder's `libs/builder/src/bundle/fs/posix-path`, whose `join` and `normalizeToForwardSlashes` are portable, and the test runner's `libs/testing/src/runner/portable-paths`, whose `normalizePath`, `relativePath` and `workspaceRelativePath` are portable. Passing the option replaces the defaults.

### `shimCommands`

Commands that are `.cmd` shims on Windows. Defaults to `npm`, `npx`, `pnpm`, `pnpx`, `yarn`, `yarnpkg`, `corepack`, `nx`, `tsc`, `eslint`, `prettier`, `vite`, `vitest`, `jest`, and `rollup`. Passing the option replaces the defaults.

### `include`

The files the rule checks, as a list of selectors. Each entry adds files and none narrows another, so a file is checked when any entry selects it.

- `{ "publishableLibraries": true }` selects every file of a publishable library, meaning a `library` project with both a `build` and a `publish` target.
- `{ "files": [...] }` selects every file matching one of its workspace-relative globs, matched with `posix.matchesGlob` from `node:path`.

Defaults to `[{ "publishableLibraries": true }]`. Passing the option replaces the default, so a list without the `publishableLibraries` entry stops checking publishable libraries. The rule matches globs against the workspace root rather than the lint config's location, so one setting in a shared base config selects the same files whichever project's lint target runs it.

## Scope

This workspace runs the rule as an error on every `.ts` and `.mjs` file of a publishable library and every such file under `tools/`, `apps/package-e2e/`, and `apps/docs-site/scripts/`, specs included. Without an `include` option, only publishable libraries are checked. Autofixes apply only on an explicit `--fix`, which `lint:all` passes.

Two checks were considered and left out. Asserting `expect(join(a, b)).toBe('a/b')` is a Windows failure in tests, but the code under test hides where the value came from. Case-insensitive path comparison matters on Windows and macOS, but nothing in the source says which comparisons are about paths.
