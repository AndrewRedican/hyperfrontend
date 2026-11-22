/**
 * Sealed-main E2E tests for `@hyperfrontend/server`.
 *
 * The packed tarball is installed into a consumer outside the workspace, and the packed entries write three service
 * builds into it the way a service build would: a CommonJS main that opens with the statement of the seal, and the
 * release manifest of its directory. Each main runs as a process of its own under plain Node, on the kernel's runner:
 * one boots and prints the digest of its manifest, one refuses a directory that changed, one refuses another section.
 */

import type { ChildProcess } from 'node:child_process'
import type { ChildExit } from '@hyperfrontend/testing/process'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, before } from 'node:test'
import { describe, expect, it, waitUntil } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

/** An immutable section of the hello service. */
type Section = Readonly<Record<string, string>>

/** A process the suite started, with what it wrote. */
interface Service {
  /** The process. */
  readonly child: ChildProcess
  /** Reads everything written to standard output so far. */
  readonly stdout: () => string
  /** Reads everything written to standard error so far. */
  readonly stderr: () => string
  /** Reads how the process ended, once it has and both streams have closed. */
  readonly exit: () => ChildExit | undefined
}

/** One service build the consumer writes with the packed entries. */
interface SealedBuild {
  /** The directory of the build. */
  readonly directory: string
  /** The section the build is sealed with. */
  readonly sealed: Section
  /** The CommonJS program that follows the statement of the seal. */
  readonly program: string
}

// note: 30s bounds every wait on a line or an exit: slack for slow CI hosts, and inside the timeout of the format, so a wait that fails says what the process wrote.
const WAIT_MS = 30000

/** The variables the hello service declares, which the machine running the suite may not hand to it. */
const DECLARED_VARIABLES = ['PORT', 'HOST', 'HELLO_GREETING']

/** The section every build is sealed with. */
const SECTION: Section = { greeting: 'Hello' }

/**
 * Writes the hello service as the CommonJS program of a built main: one call of the runner around a routed service.
 *
 * @param section - The immutable section of the definition.
 * @returns The program's source, without the directive and the statement a build puts ahead of it.
 */
function helloProgram(section: Section): string {
  return [
    "const { defineService, health, jsonResponse, readiness, route, router, runService, startService } = require('@hyperfrontend/server')",
    "const { asPort, asText, defineEnvironment, optional, required } = require('@hyperfrontend/server/environment')",
    '',
    'const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))',
    'let listening = false',
    'runService(',
    '  defineService({',
    '    environment: defineEnvironment({',
    "      http: { PORT: optional(asPort({ allowZero: true }), 8080), HOST: optional(asText(), '127.0.0.1') },",
    '      hello: { HELLO_GREETING: required(asText()) },',
    '    }),',
    `    immutable: ${JSON.stringify(section)},`,
    '    async start(values, context) {',
    '      const handle = await startService(',
    '        {',
    '          port: values.http.PORT,',
    '          host: values.http.HOST,',
    '          steps: [',
    '            health(),',
    '            readiness({ checks: { listening: () => listening } }),',
    '            router({',
    "              hello: route('GET', '/hello/:name', (request) => jsonResponse(200, { message: `${values.hello.HELLO_GREETING}, ${request.params.name}` })),",
    "              wait: route('GET', '/wait', async () => (await pause(500), jsonResponse(200, { waited: true }))),",
    "              fault: route('POST', '/fault', () => (void Promise.reject(new Error('fault-marker\\n    at fault-marker (evil:1:1)')), jsonResponse(202, { accepted: true }))),",
    '            }),',
    '          ],',
    '        },',
    '        { report: context.report }',
    '      )',
    '      listening = true',
    '      return handle',
    '    },',
    '  })',
    ')',
    '',
  ].join('\n')
}

/**
 * Builds the environment a main inherits: this process's, without the variables the hello service declares and without the test runner's own.
 *
 * @returns Variables for a child that reads only what the suite sets.
 */
function inheritedEnvironment(): NodeJS.ProcessEnv {
  const kept = Object.entries(process.env).filter(
    ([name]) => !DECLARED_VARIABLES.includes(name.toUpperCase()) && name !== 'NODE_TEST_CONTEXT' && !name.startsWith('HF_TEST_')
  )
  return Object.fromEntries(kept)
}

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

/**
 * Starts the main of a build as a process of its own under plain Node, with an IPC channel to this one.
 *
 * @param build - The build's directory, relative to the consumer.
 * @returns The process and readers of what it writes.
 */
function startMain(build: string): Service {
  const child = spawn(process.execPath, [join(consumer.path, build, 'main.cjs')], {
    cwd: consumer.path,
    env: { ...inheritedEnvironment(), PORT: '0', HELLO_GREETING: 'Hello' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  let stdout = ''
  let stderr = ''
  let exit: ChildExit | undefined
  let openStreams = 2
  const closed = (): void => {
    openStreams -= 1
  }
  child.stdout?.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk))
  child.stderr?.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk))
  // why: Node never emits 'close' for a child whose channel this process disconnected, so the end is the exit and the close of both streams.
  child.stdout?.once('close', closed)
  child.stderr?.once('close', closed)
  child.once('exit', (code, signal) => {
    exit = { code, signal }
  })
  return { child, stdout: () => stdout, stderr: () => stderr, exit: () => (openStreams === 0 ? exit : undefined) }
}

/**
 * Waits for something a process shows: a line, or its end.
 *
 * @param service - The process.
 * @param what - What is waited for, for the failure.
 * @param read - Reads it; a falsy value says it is not there yet.
 * @returns What was read.
 */
async function observed<Value>(service: Service, what: string, read: () => Value): Promise<NonNullable<Value>> {
  let ended = false
  try {
    return await waitUntil(
      () => {
        const value = read()
        ended = !value && service.exit() !== undefined
        if (ended) throw new Error(what)
        return value
      },
      { timeout: WAIT_MS, interval: 10 }
    )
  } catch {
    const reason = ended ? 'the process ended first' : `${WAIT_MS} ms passed`
    throw new Error(`${what} did not show: ${reason}.\nstandard output:\n${service.stdout()}\nstandard error:\n${service.stderr()}`)
  }
}

/**
 * Waits for the started line of a main.
 *
 * @param service - The process.
 * @returns The digest of the release manifest the line carries, when it carries one.
 */
async function startedRelease(service: Service): Promise<string | undefined> {
  const finished = (): string[] => service.stdout().split(/\r?\n/).slice(0, -1)
  const line = await observed(service, 'the started line', () => finished().find((written) => written.split(' ')[0] === 'started'))
  return / release=([0-9a-f]{64})$/.exec(line)?.[1]
}

/**
 * Waits for the end of a process.
 *
 * @param service - The process.
 * @returns Its exit code or the signal that ended it.
 */
function ended(service: Service): Promise<ChildExit> {
  return observed(service, 'the end of the process', service.exit)
}

/**
 * Ends a process the suite left running and waits until it is gone, so that the consumer's directory can be deleted.
 *
 * @param service - The process, when the suite got as far as starting one.
 */
async function discard(service: Service | undefined): Promise<void> {
  if (service === undefined || service.exit() !== undefined) return
  service.child.kill('SIGKILL')
  await ended(service)
}

describe('@hyperfrontend/server sealed main', () => {
  before(() => {
    const builds: SealedBuild[] = [
      { directory: join(consumer.path, 'boot'), sealed: SECTION, program: helloProgram(SECTION) },
      { directory: join(consumer.path, 'changed'), sealed: SECTION, program: helloProgram(SECTION) },
      { directory: join(consumer.path, 'reseated'), sealed: SECTION, program: helloProgram({ greeting: 'Goodbye' }) },
    ]
    consumer.run(
      (written: readonly SealedBuild[]) => {
        const { mkdirSync, writeFileSync } = require('node:fs')
        const { join } = require('node:path')
        const { sealServiceBuild } = require('@hyperfrontend/server')
        const { RELEASE_MANIFEST_FILENAME, createReleaseManifest, serializeReleaseManifest } = require('@hyperfrontend/server/manifest')
        for (const build of written) {
          mkdirSync(build.directory, { recursive: true })
          writeFileSync(join(build.directory, 'main.cjs'), `'use strict';\n${sealServiceBuild(build.sealed).statement}\n${build.program}`)
          const manifest = createReleaseManifest({ root: build.directory, name: 'hello', version: '1.0.0' })
          writeFileSync(join(build.directory, RELEASE_MANIFEST_FILENAME), serializeReleaseManifest(manifest))
        }
        return null
      },
      { kind: 'require', args: builds }
    )
    // why: the file arrives after the manifest was written, as a file dropped into a deployed directory would.
    consumer.write(join('changed', 'extra.txt'), 'one more')
  })

  describe('in the directory it was built into', () => {
    let service: Service | undefined
    let release: string | undefined

    before(async () => {
      service = startMain('boot')
      release = await startedRelease(service)
      service.child.disconnect()
      await ended(service)
    })

    after(() => discard(service))

    it('prints the SHA-256 of its release manifest in the started line', () => {
      const manifest = readFileSync(join(consumer.path, 'boot', 'hf-release.json'))
      expect(release).toBe(createHash('sha256').update(manifest).digest('hex'))
    })
  })

  describe('in a directory that gained a file', () => {
    let service: Service | undefined
    let exit: ChildExit | undefined

    before(async () => {
      service = startMain('changed')
      exit = await ended(service)
    })

    after(() => discard(service))

    it('exits 78', () => {
      expect(exit).toEqual({ code: 78, signal: null })
    })

    it('names the file that is present but not listed', () => {
      expect(service?.stderr()).toBe('fatal cause=release\n  - extra.txt is present but not listed.\n')
    })
  })

  describe('running another section than it was sealed with', () => {
    let service: Service | undefined
    let exit: ChildExit | undefined

    before(async () => {
      service = startMain('reseated')
      exit = await ended(service)
    })

    after(() => discard(service))

    it('exits 78', () => {
      expect(exit).toEqual({ code: 78, signal: null })
    })

    it('names the immutable section as the cause', () => {
      expect(service?.stderr().split(/\r?\n/)[0]).toBe('fatal cause=immutable')
    })
  })
})
