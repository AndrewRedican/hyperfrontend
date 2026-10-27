/**
 * The workspace's own command line. Usage, from anywhere inside the workspace:
 * `node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/hf.ts run <project>:<target> [--name=value ...]`
 * runs that one task, nothing it depends on first and nothing cached, from the workspace root,
 * and exits 0 when it succeeds and 1 otherwise. The arguments after the task merge over the
 * target's options, or reach the commands of an `nx:run-commands` target.
 *
 * @module bin/hf
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findUpwardWhere } from '@hyperfrontend/project-scope/core'
import { pathKey, searchPath } from '../src/runner/environment'
import { main } from '../src/runner/run'

/**
 * Writes a line of the command line's own to standard error, leaving standard output to the task.
 *
 * @param line - The text, without its newline
 */
function write(line: string): void {
  process.stderr.write(`${line}\n`)
}

/**
 * Ends the process once both standard streams have taken everything written to them.
 *
 * @param code - 0 when the task succeeded, 1 otherwise
 */
function exit(code: number): void {
  process.stdout.write('', () => process.stderr.write('', () => process.exit(code)))
}

const root = findUpwardWhere(process.cwd(), (directory) => existsSync(join(directory, 'nx.json')))
if (root === null) {
  write('run from inside the workspace: no nx.json above the working directory')
  process.exit(1)
}
const key = pathKey(process.env, process.platform)
// why: the tasks and the processes their executors start find the workspace's own binaries first, as they did when npx started them
process.env[key] = searchPath(root, process.env[key], process.execPath, process.platform)

main(process.argv.slice(2), {
  root,
  cwd: process.cwd(),
  env: process.env,
  platform: process.platform,
  execPath: process.execPath,
  spawn: (command, options) => spawn(command, options),
  write,
  importModule: (file) => import(pathToFileURL(file).href),
}).then(exit)
