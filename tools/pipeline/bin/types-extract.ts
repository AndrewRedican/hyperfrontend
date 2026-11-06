/**
 * Regenerates or checks the upstream-compatible declarations the workspace carries. Usage, from
 * the workspace root: `node --import ./libs/workspace/src/hooks/index.ts tools/pipeline/bin/types-extract.ts [--check | --update]`;
 * the targets run through `npx hf run tool-pipeline:types-extract` and `npx hf run tool-pipeline:types-extract-check` pass the hook.
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
const root = findUpwardWhere(process.cwd(), (directory) => existsSync(join(directory, 'hf.json')))
if (root === null) throw createError('run from inside the workspace: no hf.json above the working directory')

// why: tools/pipeline compiles as CommonJS (its tsconfig.json), which rules out a top-level await; the promise sets the exit code when it settles.
void runTypesExtract(config, values.check ? 'check' : values.update ? 'update' : 'write', {
  readFile: (path) => readFileIfExists(join(root, path)),
  writeFile: (path, text) => writeFileContent(join(root, path), text),
  fetchText: createFetch(process.env['GITHUB_TOKEN']),
  log: (line) => process.stdout.write(`${line}\n`),
}).then((code) => {
  process.exitCode = code
})
