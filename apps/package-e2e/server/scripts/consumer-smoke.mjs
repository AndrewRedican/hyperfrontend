#!/usr/bin/env node
/**
 * Places the built @hyperfrontend/server in a throwaway consumer outside the workspace and checks
 * what a consumer does with it on the running Node.js, with all four entries resolved through
 * `import` and through `require`: a config is validated and the static server binds a port the
 * operating system picks, serves one file with its header rules and the encoding the request asked
 * for, answers the conditional request that follows with 304, and closes; an environment is loaded
 * and a service started from its values answers one routed request and closes; the runner takes a
 * service from its started line to its exit code over a process handed to it; and the served
 * directory is indexed as a release and verified against its own manifest. Plain JavaScript with no
 * dependencies, so it runs on the package's floor release.
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
import { createHash } from 'node:crypto'
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
      "import { EventEmitter } from 'node:events'",
      "import { get } from 'node:http'",
      "import { brotliDecompressSync as decode } from 'node:zlib'",
      "import { defineService, jsonResponse, route, router, runService, startService, startStaticServer } from '@hyperfrontend/server'",
      "import { asPort, asText, defineEnvironment, optional } from '@hyperfrontend/server/environment'",
      "import { createReleaseManifest, verifyRelease } from '@hyperfrontend/server/manifest'",
      "import { isolationRules, validateServeConfig } from '@hyperfrontend/server/policy'",
    ],
  },
  {
    kind: 'require',
    file: 'serve.cjs',
    encoding: 'gzip',
    prologue: [
      "'use strict'",
      "const { EventEmitter } = require('node:events')",
      "const { get } = require('node:http')",
      "const { gunzipSync: decode } = require('node:zlib')",
      "const { defineService, jsonResponse, route, router, runService, startService, startStaticServer } = require('@hyperfrontend/server')",
      "const { asPort, asText, defineEnvironment, optional } = require('@hyperfrontend/server/environment')",
      "const { createReleaseManifest, verifyRelease } = require('@hyperfrontend/server/manifest')",
      "const { isolationRules, validateServeConfig } = require('@hyperfrontend/server/policy')",
    ],
  },
]

/** The consumer's program, the same under both module systems once its prologue has run. */
const PROGRAM = [
  'const [root, encoding] = process.argv.slice(2)',
  '',
  'const request = (port, path, headers) =>',
  '  new Promise((resolve, reject) => {',
  "    get({ host: '127.0.0.1', port, path, agent: false, headers }, (response) => {",
  '      const chunks = []',
  "      response.on('data', (chunk) => chunks.push(chunk))",
  "      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }))",
  "    }).on('error', reject)",
  '  })',
  '',
  'const declare = () =>',
  "  defineEnvironment({ http: { PORT: optional(asPort({ allowZero: true }), 8080), HOST: optional(asText(), '127.0.0.1') } })",
  "const table = () => [router({ 'things.read': route('GET', '/things/:id', (incoming) => jsonResponse(200, { id: incoming.params.id })) })]",
  '',
  'const serveFiles = async () => {',
  "  const authored = { isolation: 'require-corp', headers: [{ suffix: '.js', headers: { 'Cache-Control': 'no-cache' } }] }",
  "  const config = validateServeConfig(authored, 'smoke')",
  '  const headers = [...isolationRules(config.isolation), ...config.headers]',
  "  const server = await startStaticServer({ root, port: 0, host: '127.0.0.1', log: false, headers })",
  '  try {',
  "    const served = await request(server.port, '/app.js', { 'accept-encoding': encoding })",
  "    const again = await request(server.port, '/app.js', { 'if-none-match': served.headers.etag })",
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
  'const serveRoute = async () => {',
  "  const values = declare().load({ PORT: '0' })",
  '  const service = await startService({ steps: table(), port: values.http.PORT, host: values.http.HOST })',
  '  try {',
  "    const answered = await request(service.port, '/things/7', {})",
  '    return {',
  '      port: values.http.PORT,',
  '      host: values.http.HOST,',
  '      rooted: service.url === `http://127.0.0.1:${service.port}/`,',
  '      status: answered.status,',
  "      body: answered.body.toString('utf8'),",
  '    }',
  '  } finally {',
  '    await service.close()',
  '  }',
  '}',
  '',
  'const runWhole = async () => {',
  '  const lines = []',
  '  const exits = []',
  '  const waiting = []',
  '  const output = {',
  '    write: (text, done) => {',
  '      lines.push(text)',
  '      waiting.splice(0).forEach((look) => look())',
  '      if (done) done()',
  '    },',
  '  }',
  '  const written = (opening) =>',
  '    new Promise((resolve) => {',
  '      const look = () => {',
  '        const line = lines.find((text) => text.startsWith(opening))',
  '        if (line === undefined) waiting.push(look)',
  '        else resolve(line)',
  '      }',
  '      look()',
  '    })',
  '  const stood = Object.assign(new EventEmitter(), {',
  "    env: { PORT: '0' },",
  '    platform: process.platform,',
  '    stdout: output,',
  '    stderr: output,',
  '    exit: (code) => exits.push(code),',
  '  })',
  '  const definition = defineService({',
  '    environment: declare(),',
  '    start: (values, context) =>',
  '      startService({ steps: table(), port: values.http.PORT, host: values.http.HOST }, { report: context.report }),',
  '  })',
  '  const code = runService(definition, { process: stood, build: null })',
  "  const started = await Promise.race([written('started port='), code.then(() => null)])",
  "  if (started === null) throw new Error(`the run ended before it started: ${lines.join('')}`)",
  "  const answered = await request(Number(started.slice('started port='.length)), '/things/9', {})",
  "  await written('request ')",
  "  stood.emit('SIGTERM')",
  '  return { code: await code, exits, status: answered.status, lines: lines.map((text) => text.split(/[ \\n]/)[0]) }',
  '}',
  '',
  'const indexRelease = async () => {',
  "  const manifest = createReleaseManifest({ root, name: 'consumer-site', version: '1.0.0' })",
  '  return { files: manifest.files.map((file) => [file.path, file.size, file.sha256]), issues: verifyRelease(root, manifest) }',
  '}',
  '',
  'const attempt = (part) => part().catch((error) => ({ error: String(error && error.stack ? error.stack : error) }))',
  '',
  'const main = async () => ({',
  '  files: await attempt(serveFiles),',
  '  route: await attempt(serveRoute),',
  '  run: await attempt(runWhole),',
  '  release: await attempt(indexRelease),',
  '})',
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

/**
 * Lists what each part of the consumer's program is held to.
 *
 * @param encoding - The encoding the program asks the static server for
 * @returns One entry per part: its key in the program's output, what it checks, and the result it must print
 */
const partsFor = (encoding) => [
  [
    'files',
    `starts the static server on a port the system picks, serves one file as ${encoding} and revalidates it`,
    { status: 200, cacheControl: 'no-cache', embedderPolicy: 'require-corp', encoding, text: SCRIPT, revalidated: 304 },
  ],
  [
    'route',
    'loads an environment, starts a service from its values, answers one routed request and closes',
    { port: 0, host: '127.0.0.1', rooted: true, status: 200, body: '{"id":"7"}' },
  ],
  [
    'run',
    'runs a service from its started line to exit code 0 over a process handed to the runner',
    { code: 0, exits: [0], status: 200, lines: ['started', 'request', 'stopping', 'stopped', '', ''] },
  ],
  [
    'release',
    'indexes the served directory as a release and verifies it against its own manifest',
    { files: [['app.js', Buffer.byteLength(SCRIPT), createHash('sha256').update(SCRIPT).digest('hex')]], issues: [] },
  ],
]

/**
 * Reads what the consumer's program printed.
 *
 * @param run - The finished process
 * @returns The program's result by part, or nothing by any part when the process failed or printed no JSON
 */
const resultsOf = (run) => {
  try {
    return run.status === 0 ? JSON.parse(run.stdout) : {}
  } catch {
    return {}
  }
}

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
    const results = resultsOf(run)
    // note: A process that never ended by itself is killed at the timeout and has a signal where its status would be.
    const ending = `${run.status ?? run.signal} ${run.stderr || run.stdout}`
    for (const [part, name, expected] of partsFor(encoding)) {
      const seen = JSON.stringify(results[part])
      check(`${kind} ${name}`, seen === JSON.stringify(expected), seen ?? ending)
    }
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exitCode = 1
}
