/**
 * The linter's command. Usage, from a project root: `node tools/lint/bin/lint.ts [paths...] [flags]`;
 * `--help` lists the flags. The aliases are installed first; the command's flow is imported
 * after, because it imports workspace libraries.
 *
 * @module bin/lint
 */

import { readFileSync } from 'node:fs'
import '../src/runtime/aliases.ts'

const { run } = await import('../src/cli/run.ts')
process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  readStdin: () => readFileSync(0, 'utf8'),
  write: (text) => process.stdout.write(text),
  writeError: (text) => process.stderr.write(text),
})
