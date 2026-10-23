/**
 * The workspace's lint command once the aliases are installed: the package's `run`, given this
 * process's arguments, working directory and streams.
 *
 * @module bin/command
 */

import { readFileSync } from 'node:fs'
import { run } from '@hyperfrontend/linter'

process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  readStdin: () => readFileSync(0, 'utf8'),
  write: (text) => process.stdout.write(text),
  writeError: (text) => process.stderr.write(text),
})
