/**
 * Disposable projects for the cross-platform rule, one per kind of project it treats
 * differently: a publishable library on Node, a publishable library whose `node:` imports sit
 * only where they must not count, a library that is not published and has no workspace above
 * it, an application under `tools/` in a workspace, a publishable library without sources, a
 * publishable library with no workspace above it, and a directory no project owns.
 *
 * @module rules/workspace/__fixtures__/cross-platform-workspace
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** A runtime source importing a `node:` module. */
const NODE_IMPORT = "import { join } from 'node:path'\n"

/** The project file of a publishable library. */
const PUBLISHABLE = stringify({ projectType: 'library', targets: { build: {}, publish: {} } })

/** The files of the fixture, by path below its root. */
const FILES: Readonly<Record<string, string>> = {
  'node/nx.json': '{}',
  'node/project.json': PUBLISHABLE,
  'node/src/view.ts': 'export {}\n',
  'node/src/deep/runtime.ts': NODE_IMPORT,
  'browser/nx.json': '{}',
  'browser/project.json': PUBLISHABLE,
  'browser/src/view.ts': 'export {}\n',
  'browser/src/view.spec.ts': NODE_IMPORT,
  'browser/src/test.setup.ts': NODE_IMPORT,
  'browser/src/types.d.ts': NODE_IMPORT,
  'browser/src/__fixtures__/fixture.ts': NODE_IMPORT,
  'browser/src/node_modules/dep/index.ts': NODE_IMPORT,
  'browser/src/notes.md': NODE_IMPORT,
  'unpublished/project.json': stringify({ projectType: 'library', targets: { build: {} } }),
  'unpublished/src/runtime.ts': NODE_IMPORT,
  'tool/nx.json': '{}',
  'tool/tools/app/project.json': stringify({ projectType: 'application', targets: { build: {}, serve: {} } }),
  'tool/tools/app/src/runtime.ts': NODE_IMPORT,
  'bare/nx.json': '{}',
  'bare/project.json': PUBLISHABLE,
  'lonely/project.json': PUBLISHABLE,
  'lonely/src/runtime.ts': NODE_IMPORT,
  'projectless/.keep': '',
}

/** The roots of the fixture's projects. */
export interface CrossPlatformWorkspace {
  /** The directory holding them all. */
  readonly root: string
  /** The publishable library whose runtime sources import `node:`. */
  readonly node: string
  /** The publishable library whose runtime sources never import `node:`. */
  readonly browser: string
  /** The library that is not published, with no workspace root above it. */
  readonly unpublished: string
  /** The workspace whose application sits at `tools/app`. */
  readonly tool: string
  /** The publishable library without a `src` directory. */
  readonly bare: string
  /** The publishable library on Node with no workspace root above it. */
  readonly lonely: string
  /** The directory no project owns. */
  readonly projectless: string
}

/**
 * Creates the projects in a temporary directory.
 *
 * @returns Their roots
 */
export function createCrossPlatformWorkspace(): CrossPlatformWorkspace {
  const root = mkdtempSync(join(tmpdir(), 'lint-cross-platform-'))
  for (const [path, text] of entries(FILES)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return {
    root,
    node: join(root, 'node'),
    browser: join(root, 'browser'),
    unpublished: join(root, 'unpublished'),
    tool: join(root, 'tool'),
    bare: join(root, 'bare'),
    lonely: join(root, 'lonely'),
    projectless: join(root, 'projectless'),
  }
}

/** The message templates the previous implementation recorded, by id. */
const TEMPLATES: Readonly<Record<string, string>> = {
  "separatorLiteral": "`.{{ method }}()` matches a hardcoded '/' against a native path, which uses '\\' on Windows. Match `sep` from node:path, or convert the path first with `normalizePath` from @hyperfrontend/project-scope/core/path, or `.split(sep).join(posix.sep)` where that package cannot be imported.",
  "absoluteCheck": "`startsWith('/')` never matches a Windows absolute path such as 'C:\\x'. Use `isAbsolute()` from node:path.",
  "separatorJoin": "A native path is joined to more segments with a hardcoded '/', which mixes separators on Windows. Use `join()` from node:path, or `posix.join()` when the value is a portable path.",
  "relativeEscapes": "`relative()` returns backslashes on Windows, and this result leaves as data (a key, an Nx root, a stored or returned value). Convert it with `relativePath` or `workspaceRelativePath` from @hyperfrontend/project-scope/core/path, or `.split(sep).join(posix.sep)` where that package cannot be imported.",
  "driveLetterLoss": "Rebuilding an absolute path as '/' plus joined segments drops the drive on Windows: 'C:\\x' becomes '/C:/x'. Walk up with `dirname()` instead.",
  "posixConversion": "Convert native paths to POSIX with `normalizePath` from @hyperfrontend/project-scope/core/path, or `.split(sep).join(posix.sep)` where that package cannot be imported. This spelling also rewrites backslashes on POSIX, where they are legal file-name characters.",
  "lineSplit": "Splitting on a bare line feed leaves '\\r' on every line of a CRLF file. Split on `/\\r?\\n/`.",
  "nativeImport": "`import()` of a native path fails on Windows, where 'C:\\x' parses as a URL with scheme 'c:'. Import `pathToFileURL(path).href` from node:url instead.",
  "nativeSpecifier": "`{{ target }}` takes a module specifier, and a native path fails on Windows, where 'C:\\x' parses as a URL with scheme 'c:'. Pass `pathToFileURL(path).href` from node:url instead.",
  "urlPathname": "`.pathname` of a module URL is '/C:/x' with percent-encoding on Windows. Use `fileURLToPath()` from node:url.",
  "shellShim": "'{{ command }}' is a .cmd shim on Windows and cannot be spawned without a shell (ENOENT or EINVAL). Pass `shell: process.platform === 'win32'` and keep its arguments free of spaces and shell metacharacters.",
  "binShim": "'{{ command }}' under node_modules/.bin is a shell script on POSIX and a .cmd shim on Windows, which cannot be spawned without a shell (ENOENT or EINVAL), and a shell splits a path that contains a space. Spawn `process.execPath` with the package's entry script, resolved with `require.resolve()`.",
  "splitCommand": "`{{ command }}` is the first word of a split command line, and a .cmd shim such as `npm` cannot be spawned without a shell on Windows (ENOENT or EINVAL). Run the whole line through a shell: `execFileSync(line, { shell: true })`.",
  "hardcodedTmp": "'{{ path }}' does not exist on Windows. Use `tmpdir()` or `devNull` from node:os."
}

/**
 * A message as the previous implementation worded it.
 *
 * @param id - The message's id
 * @param data - The values of its placeholders
 * @returns The message text
 */
export function recordedMessage(id: string, data: Readonly<Record<string, string>> = {}): string {
  let text = TEMPLATES[id] as string
  for (const [name, value] of entries(data)) text = text.split(`{{ ${name} }}`).join(value)
  return text
}
