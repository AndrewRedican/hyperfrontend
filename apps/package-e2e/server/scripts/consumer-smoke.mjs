#!/usr/bin/env node
/**
 * Places the built @hyperfrontend/server in a throwaway consumer outside the workspace and checks
 * what a consumer does with it on the running Node.js: both entries resolve through `import` and
 * `require`, a config is validated, and the static server binds a port the operating system picks,
 * serves one file with its header rules and the encoding the request asked for, answers the
 * conditional request that follows with 304, and closes. Plain JavaScript with no dependencies, so
 * it runs on the package's floor release.
 *
 * The built package is copied into the consumer's `node_modules` where an install would put it,
 * because the npm that ships beside a current Node.js does not run on the floor release. That is
 * the same tree an install produces only while the package declares no dependencies, which the
 * first check holds it to.
 *
 * Usage, from the workspace root after `npx hf run lib-server:build`:
 *
 *   node apps/package-e2e/server/scripts/consumer-smoke.mjs
 */
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', '..', 'dist', 'libs', 'server')

// note: Long enough to cross the size below which the server leaves a body unencoded.
const SCRIPT = `export const rows = [\n${"  'a row the compressor folds into the one before it',\n".repeat(40)}]\n`

/** What each module system brings in, and how it names the encoding it asks for. */
const KINDS = [
  {
    kind: 'import',
    file: 'serve.mjs',
    encoding: 'br',
    prologue: [
      "import { get } from 'node:http'",
      "import { brotliDecompressSync as decode } from 'node:zlib'",
      "import { startStaticServer } from '@hyperfrontend/server'",
      "import { isolationRules, validateServeConfig } from '@hyperfrontend/server/policy'",
    ],
  },
  {
    kind: 'require',
    file: 'serve.cjs',
    encoding: 'gzip',
    prologue: [
      "'use strict'",
      "const { get } = require('node:http')",
      "const { gunzipSync: decode } = require('node:zlib')",
      "const { startStaticServer } = require('@hyperfrontend/server')",
      "const { isolationRules, validateServeConfig } = require('@hyperfrontend/server/policy')",
    ],
  },
]

/** The consumer's program, the same under both module systems once its prologue has run. */
const PROGRAM = [
  'const [root, encoding] = process.argv.slice(2)',
  '',
  'const request = (port, headers) =>',
  '  new Promise((resolve, reject) => {',
  "    get({ host: '127.0.0.1', port, path: '/app.js', agent: false, headers }, (response) => {",
  '      const chunks = []',
  "      response.on('data', (chunk) => chunks.push(chunk))",
  "      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }))",
  "    }).on('error', reject)",
  '  })',
  '',
  'const main = async () => {',
  "  const authored = { isolation: 'require-corp', headers: [{ suffix: '.js', headers: { 'Cache-Control': 'no-cache' } }] }",
  "  const config = validateServeConfig(authored, 'smoke')",
  '  const headers = [...isolationRules(config.isolation), ...config.headers]',
  "  const server = await startStaticServer({ root, port: 0, host: '127.0.0.1', log: false, headers })",
  '  try {',
  "    const served = await request(server.port, { 'accept-encoding': encoding })",
  "    const again = await request(server.port, { 'if-none-match': served.headers.etag })",
  '    return {',
  '      status: served.status,',
  "      cacheControl: served.headers['cache-control'],",
  "      embedderPolicy: served.headers['cross-origin-embedder-policy'],",
  "      encoding: served.headers['content-encoding'],",
  "      text: decode(served.body).toString('utf8'),",
  '      revalidated: again.status,',
  '    }',
  '  } finally {',
  '    await server.close()',
  '  }',
  '}',
  '',
  'main().then(',
  '  (result) => process.stdout.write(JSON.stringify(result)),',
  '  (error) => {',
  '    process.stderr.write(String(error && error.stack ? error.stack : error))',
  '    process.exitCode = 1',
  '  }',
  ')',
  '',
]

const root = mkdtempSync(join(tmpdir(), 'server-smoke-'))
const failures = []

/**
 * Records a check.
 *
 * @param name - What was checked
 * @param passed - Whether it held
 * @param detail - What was seen, printed when it did not hold
 */
const check = (name, passed, detail) => {
  process.stdout.write(`${passed ? 'ok' : 'not ok'} - ${name}\n`)
  if (!passed) failures.push(`${name}: ${detail}`)
}

try {
  const manifest = JSON.parse(readFileSync(join(DIST, 'package.json'), 'utf8'))
  const declared = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
  check('the built package declares no dependencies', declared.length === 0, declared.join(', '))

  const consumer = join(root, 'consumer')
  const site = join(consumer, 'site')
  mkdirSync(site, { recursive: true })
  mkdirSync(join(consumer, 'node_modules', '@hyperfrontend'), { recursive: true })
  writeFileSync(join(consumer, 'package.json'), '{ "name": "consumer", "version": "1.0.0", "private": true }\n')
  writeFileSync(join(site, 'app.js'), SCRIPT)
  cpSync(DIST, join(consumer, 'node_modules', '@hyperfrontend', 'server'), { recursive: true })

  for (const { kind, file, encoding, prologue } of KINDS) {
    writeFileSync(join(consumer, file), [...prologue, '', ...PROGRAM].join('\n'))
    const run = spawnSync(process.execPath, [file, site, encoding], { cwd: consumer, encoding: 'utf8', timeout: 60_000 })
    const expected = JSON.stringify({
      status: 200,
      cacheControl: 'no-cache',
      embedderPolicy: 'require-corp',
      encoding,
      text: SCRIPT,
      revalidated: 304,
    })
    check(
      `${kind} starts the server on a port the system picks, serves one file as ${encoding} and revalidates it`,
      run.status === 0 && run.stdout === expected,
      `${run.status} ${run.stderr || run.stdout}`
    )
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exitCode = 1
}
