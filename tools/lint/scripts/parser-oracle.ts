/**
 * Compares the new scanner with the installed TypeScript compiler over every tracked code file.
 * Usage, from the workspace root: `node tools/lint/scripts/parser-oracle.ts [--subject path] [--limit n] [--filter substring]`.
 * This is the only place the compiler is loaded; a lint run never does.
 *
 * @module scripts/parser-oracle
 */

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// why: the hook lives in the workspace package and is named by its path, since the aliases that would name it by specifier do not exist until it is installed
await import(pathToFileURL(join(import.meta.dirname, '..', '..', '..', 'libs', 'workspace', 'src', 'hooks', 'index.ts')).href)

const { main } = await import('./lib/parser-oracle-main.ts')
await main(process.argv.slice(2))
