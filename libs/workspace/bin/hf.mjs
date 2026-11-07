#!/usr/bin/env node
/**
 * The `hf` executable of a workspace that carries this package's sources: `npx hf <command>` from
 * any directory inside it. It installs the resolution hook the TypeScript sources need, then
 * runs the command line itself. The built package ships its bundled command line under this
 * same path.
 *
 * @module bin/hf-launcher
 */

// why: the hook installs itself for the workspace above the working directory when it is imported, and nothing written in TypeScript with extensionless imports loads before it
await import('../src/hooks/index.ts')

const { runHf } = await import('../src/bin/hf.ts')
const code = await runHf({ argv: process.argv.slice(2), cwd: process.cwd() })
// why: the process ends once both standard streams have taken everything written to them
process.stdout.write('', () => process.stderr.write('', () => process.exit(code)))
