#!/usr/bin/env node
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(here, '..', '..')
const tsconfig = resolve(workspaceRoot, 'tsconfig.base.json')

process.env.SWC_NODE_PROJECT = process.env.SWC_NODE_PROJECT ?? tsconfig
process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT ?? tsconfig

register('@swc-node/register/esm', pathToFileURL(workspaceRoot + '/'))

const { runCz } = await import(pathToFileURL(resolve(workspaceRoot, 'libs/versioning/src/bin/cz.ts')).href)

runCz({
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
