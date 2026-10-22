/**
 * Times the linter on fixed inputs and counts its files. Usage, from the workspace root:
 * `node tools/lint/scripts/bench.ts [--runs n]`.
 *
 * @module scripts/bench
 */

import '../src/runtime/aliases.ts'

const { main } = await import('./lib/bench-main.ts')
main(process.argv.slice(2))
