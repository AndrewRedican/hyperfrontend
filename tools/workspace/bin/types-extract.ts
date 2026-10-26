/**
 * Regenerates or checks the upstream-compatible declarations the workspace carries. Usage, from
 * the workspace root: `node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/types-extract.ts [--check | --update]`;
 * the Nx targets `tool-workspace:types-extract` and `tool-workspace:types-extract-check` pass the hook.
 *
 * @module bin/types-extract
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { findUpwardWhere, readFileIfExists, writeFileContent } from '@hyperfrontend/project-scope/core'
import { createFetch, runTypesExtract } from '../src/types-extract'
import config from '../types-extract.config'

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false }, update: { type: 'boolean', default: false } } })
const root = findUpwardWhere(process.cwd(), (directory) => existsSync(join(directory, 'nx.json')))
if (root === null) throw createError('run from inside the workspace: no nx.json above the working directory')

// why: the plugin's sources compile as CommonJS for Nx, which rules out a top-level await; the promise sets the exit code when it settles.
void runTypesExtract(config, values.check ? 'check' : values.update ? 'update' : 'write', {
  readFile: (path) => readFileIfExists(join(root, path)),
  writeFile: (path, text) => writeFileContent(join(root, path), text),
  fetchText: createFetch(process.env['GITHUB_TOKEN']),
  log: (line) => process.stdout.write(`${line}\n`),
}).then((code) => {
  process.exitCode = code
})
