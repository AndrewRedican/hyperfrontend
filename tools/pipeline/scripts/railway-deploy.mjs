#!/usr/bin/env node
/**
 * Deploy one commit to one Railway service and wait for the deployment to end.
 *
 * The pipeline runs this as the `deploy` task of a demo or a service on `main`, after the project's
 * own tasks have passed, so Railway builds the exact commit the run checked rather than whatever the
 * branch head is by the time it asks. The deploy goes through the Railway CLI's
 * `redeploy --commit`, which builds the commit from the service's connected repository once
 * without pinning it, so the service's configured branch stays what the IaC says.
 *
 * Written as plain JavaScript with no dependencies, like the floor probe beside it. The CLI is
 * fetched by npx at a pinned version, so the runner needs nothing installed.
 *
 * Environment:
 *
 *   HF_DEPLOY_SERVICE  the service, as `metadata.deploy.service` names it (required)
 *   RAILWAY_TOKEN      a project token of the production environment (required)
 *   HF_DEPLOY_COMMIT   the commit to deploy; `GITHUB_SHA`, then `git rev-parse HEAD`, by default
 *   HF_DEPLOY_TIMEOUT  how long to wait for the deployment, in minutes (default 30)
 *
 * Usage, from the workspace root:
 *
 *   HF_DEPLOY_SERVICE=clock node tools/pipeline/scripts/railway-deploy.mjs
 */
import { spawn } from 'node:child_process'

/** The CLI release every deploy runs; `redeploy --commit` arrived in 5.71. */
const CLI = '@railway/cli@5.71.0'

/** The statuses a deployment ends in. */
const ENDED = {
  SUCCESS: true,
  FAILED: false,
  CRASHED: false,
  REMOVED: false,
  SKIPPED: false,
}

/** How many lines of a failed deployment's build log the task prints. */
const TAIL_LINES = 40

/** How long between two reads of the deployment's status. */
const POLL_MS = 15 * 1000

/**
 * Run a command to its end, capturing what it prints.
 *
 * @param file - The program.
 * @param args - Its arguments.
 * @returns The exit code and the output, standard output and error apart.
 */
const run = (file, args) =>
  new Promise((resolve) => {
    // why: npx is a .cmd shim on Windows, which only a shell can start; the arguments hold no spaces or quotes
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => resolve({ code: null, stdout, stderr: `${stderr}${error.message}\n` }))
    child.on('exit', (code) => resolve({ code, stdout, stderr }))
  })

/**
 * Run the Railway CLI with JSON output.
 *
 * @param args - The CLI arguments.
 * @returns The parsed output.
 * @throws {Error} When the CLI fails or prints no JSON.
 */
const railway = async (args) => {
  const result = await run('npx', ['-y', CLI, ...args, '--json'])
  if (result.code !== 0) throw new Error(`railway ${args.join(' ')} exited ${result.code}\n${result.stderr.trim()}`)
  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new Error(`railway ${args.join(' ')} printed no JSON:\n${result.stdout.trim()}`)
  }
}

/**
 * The commit to deploy.
 *
 * @returns `HF_DEPLOY_COMMIT`, else `GITHUB_SHA`, else the checked-out head.
 */
const commitOf = async () => {
  const given = process.env.HF_DEPLOY_COMMIT ?? process.env.GITHUB_SHA
  if (given !== undefined && given !== '') return given
  const head = await run('git', ['rev-parse', 'HEAD'])
  if (head.code !== 0) throw new Error(`git rev-parse HEAD exited ${head.code}\n${head.stderr.trim()}`)
  return head.stdout.trim()
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Wait for a deployment to end.
 *
 * @param service - The service.
 * @param id - The deployment.
 * @param deadline - When to stop waiting, epoch milliseconds.
 * @returns The final status.
 * @throws {Error} When the deadline passes first.
 */
const waitFor = async (service, id, deadline) => {
  let last = ''
  for (;;) {
    const deployments = await railway(['deployment', 'list', '--service', service])
    const found = Array.isArray(deployments) ? deployments.find((deployment) => deployment.id === id) : undefined
    const status = found?.status ?? 'UNKNOWN'
    if (status !== last) {
      process.stdout.write(`${new Date().toISOString()} ${status}\n`)
      last = status
    }
    if (status in ENDED) return status
    if (Date.now() >= deadline) throw new Error(`deployment ${id} is still ${status} after the time limit`)
    await sleep(POLL_MS)
  }
}

/**
 * Write to standard output and wait until the text has been handed over.
 *
 * @param text - What to print.
 * @returns A promise settled once the write has ended, whether or not it succeeded.
 */
const flushed = (text) =>
  new Promise((resolve) => {
    // why: a reader that went away fails the write, and the task still has the deployment's end to report
    process.stdout.once('error', () => resolve())
    process.stdout.write(text, () => resolve())
  })

/**
 * What to print of the build log of a deployment that ended as failed: its last lines, or that it could not be read.
 *
 * @param service - The service.
 * @param id - The deployment.
 * @returns The text to print.
 * @throws {Error} When the CLI cannot even be started with these arguments.
 */
const buildLogOf = async (service, id) => {
  // why: called without the JSON helper, since the log is plain text; --lines is what stops the CLI from streaming forever
  const result = await run('npx', ['-y', CLI, 'logs', id, '--service', service, '--build', '--lines', String(TAIL_LINES)])
  const tail = result.stdout.trimEnd()
  if (result.code === 0 && tail !== '') return `the build log of deployment ${id} ends:\n${tail}\n`
  const reason = result.stderr.trim()
  return `the build log of deployment ${id} could not be read${reason === '' ? '' : `: ${reason}`}\n`
}

/**
 * Print the end of the build log of a deployment that ended as failed, the only place its reason is written.
 *
 * Railway keeps a build log for days, far less than the run's own log is kept, so the task prints it while it
 * can still be read. A log that cannot be read is reported as such and nothing more. The promise this returns
 * never rejects, whatever reading or printing the log does, so the deployment's end stays the failure the task
 * reports.
 *
 * @param service - The service.
 * @param id - The deployment.
 * @returns A promise settled once the log, or the reason it could not be read, has been printed or has failed to print.
 */
const printBuildLog = (service, id) =>
  buildLogOf(service, id)
    // why: a refused argument makes the spawn throw before any process exists, which is one more way the log cannot be read
    .catch((error) => `the build log of deployment ${id} could not be read: ${error instanceof Error ? error.message : String(error)}\n`)
    // why: the task exits as soon as the failure is thrown, and a piped output holds about 64 KB, so a longer tail would lose its end
    .then(flushed)
    // why: nothing the log does may take the place of the deployment's end as the failure the task reports
    .catch(() => undefined)

const main = async () => {
  const service = process.env.HF_DEPLOY_SERVICE
  if (service === undefined || service === '') throw new Error('HF_DEPLOY_SERVICE names no service')
  if (process.env.RAILWAY_TOKEN === undefined || process.env.RAILWAY_TOKEN === '')
    throw new Error('RAILWAY_TOKEN is not set; the deploy needs a project token of the production environment')
  const commit = await commitOf()
  const minutes = Number(process.env.HF_DEPLOY_TIMEOUT ?? '30')
  process.stdout.write(`deploying ${commit} to ${service}\n`)
  const started = await railway(['redeploy', '--service', service, '--commit', commit, '--yes'])
  const id = started?.id ?? started?.deploymentId
  if (typeof id !== 'string') throw new Error(`the redeploy answered no deployment id:\n${JSON.stringify(started)}`)
  process.stdout.write(`deployment ${id}\n`)
  const status = await waitFor(service, id, Date.now() + minutes * 60 * 1000)
  if (status === 'FAILED') await printBuildLog(service, id)
  if (!ENDED[status]) throw new Error(`deployment ${id} ended ${status}`)
  process.stdout.write(`deployed ${commit} to ${service}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
