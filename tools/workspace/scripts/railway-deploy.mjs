#!/usr/bin/env node
/**
 * Deploy one commit to one Railway service and wait for the deployment to end.
 *
 * The pipeline runs this as the `deploy` task of a demo on `main`, after the demo's own tasks
 * have passed, so Railway builds the exact commit the run checked rather than whatever the
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
 *   HF_DEPLOY_SERVICE=clock node tools/workspace/scripts/railway-deploy.mjs
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
  if (!ENDED[status]) throw new Error(`deployment ${id} ended ${status}`)
  process.stdout.write(`deployed ${commit} to ${service}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
