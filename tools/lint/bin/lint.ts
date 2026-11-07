/**
 * The workspace's lint command: `@hyperfrontend/linter` run from its TypeScript source. Usage,
 * from a project root: `node tools/lint/bin/lint.ts [paths...] [flags]`; `--help` lists the
 * flags. The aliases are installed first, so the package and the workspace libraries it and the
 * configurations import load from source without a build.
 *
 * @module bin/lint
 */

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// why: the hook lives in the workspace package and is named by its path, since the aliases that would name it by specifier do not exist until it is installed
await import(pathToFileURL(join(import.meta.dirname, '..', '..', '..', 'libs', 'workspace', 'src', 'hooks', 'index.ts')).href)

// why: an import is resolved before the module importing it runs, so the command that imports the package is loaded only once the aliases resolve it
await import('./command.ts')
