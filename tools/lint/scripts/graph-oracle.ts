/**
 * Compares the new workspace graph with the Nx graph captured by the oracle: project names,
 * roots, types, tags, implicit dependencies and edges. Usage, from the workspace root:
 * `node tools/lint/scripts/graph-oracle.ts [--corpus label]`.
 *
 * @module scripts/graph-oracle
 */

import '../src/runtime/aliases.ts'

const { main } = await import('./lib/graph-oracle-main.ts')
await main(process.argv.slice(2))
