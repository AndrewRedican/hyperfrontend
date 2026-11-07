/**
 * Times the linter on fixed inputs and counts its files. Usage, from the workspace root:
 * `node tools/lint/scripts/bench.ts [--runs n]`.
 *
 * @module scripts/bench
 */

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// why: the hook lives in the workspace package and is named by its path, since the aliases that would name it by specifier do not exist until it is installed
await import(pathToFileURL(join(import.meta.dirname, '..', '..', '..', 'libs', 'workspace', 'src', 'hooks', 'index.ts')).href)

const { main } = await import('./lib/bench-main.ts')
main(process.argv.slice(2))
