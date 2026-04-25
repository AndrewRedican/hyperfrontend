require('tsconfig-paths/register')
require('@swc-node/register')
const { runCl } = require('../../libs/versioning/src/bin/cl.ts')
runCl({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  stderr: process.stderr,
}).then(
  (code) => process.exit(code),
  (error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  }
)
