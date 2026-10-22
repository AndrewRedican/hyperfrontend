/**
 * Compares the new scanner with the installed TypeScript compiler over every tracked code file.
 * Usage, from the workspace root: `node tools/lint/scripts/parser-oracle.ts [--subject path] [--limit n] [--filter substring]`.
 * This is the only place the compiler is loaded; a lint run never does.
 *
 * @module scripts/parser-oracle
 */

import '../src/runtime/aliases.ts'

const { main } = await import('./lib/parser-oracle-main.ts')
await main(process.argv.slice(2))
