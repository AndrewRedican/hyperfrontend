#!/usr/bin/env node
/**
 * The `hf` executable of the workspace: `npx hf <command>` from any directory inside it. It installs
 * the resolution hook the TypeScript sources need, then hands over to the command line itself.
 *
 * @module bin/hf-launcher
 */

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// why: the hook belongs to another project and is named by its path, as every other start of the command line names it; importing it by specifier would draw a dependency cycle between the two projects
await import(pathToFileURL(join(import.meta.dirname, '..', '..', 'lint', 'src', 'runtime', 'aliases.ts')).href)

await import('./hf.ts')
