#!/usr/bin/env node
/**
 * Apply `.railway/railway.ts` to the production environment when it differs from what Railway holds.
 *
 * The pipeline runs this as the `provision` task of the workspace on `main`, before any deploy of
 * the run, so every demo deploys with the settings the commit declares. It plans the file against
 * the environment, and when the plan shows changes it applies that pinned plan. A destructive
 * change (a service or volume the file no longer declares) is refused, which fails the task and
 * leaves the deploys behind it unrun; applying one stays a decision made by hand.
 *
 * Written as plain JavaScript with no dependencies, like the deploy beside it. The CLI is fetched
 * by npx at a pinned version, so the runner needs nothing installed beyond the workspace's own
 * `railway` package, which evaluates the file.
 *
 * Environment:
 *
 *   RAILWAY_TOKEN      a project token of the production environment (required)
 *   HF_PROVISION_PLAN  where the pinned plan is written (default .hf/pipeline/railway-plan.json)
 *
 * Usage, from the workspace root:
 *
 *   RAILWAY_TOKEN=<project token> node tools/workspace/scripts/railway-provision.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/** The CLI release every plan and apply runs; keep it the release `railway-deploy.mjs` pins. */
const CLI = '@railway/cli@5.71.0'

/** What `config plan --detailed-exit-code` exits with. */
const PLAN = { CURRENT: 0, CHANGED: 2 }

/**
 * Run the Railway CLI with its output passed through, so the task log carries the plan.
 *
 * @param args - The CLI arguments.
 * @returns The exit code, or null when the CLI could not start.
 */
const railway = (args) =>
  new Promise((resolve) => {
    const env = { ...process.env }
    // why: the railway SDK finds the CLI through `$_`, which the shell set to whatever it ran last (node, or a wrapper such as timeout), and refuses when that program's --version is no CLI release
    delete env._
    // why: npx is a .cmd shim on Windows, which only a shell can start; the arguments hold no spaces or quotes
    const child = spawn('npx', ['-y', CLI, ...args], { stdio: 'inherit', env, shell: process.platform === 'win32' })
    child.on('error', (error) => {
      process.stderr.write(`${error.message}\n`)
      resolve(null)
    })
    child.on('exit', (code) => resolve(code))
  })

const main = async () => {
  if (process.env.RAILWAY_TOKEN === undefined || process.env.RAILWAY_TOKEN === '')
    throw new Error('RAILWAY_TOKEN is not set; the provision needs a project token of the production environment')
  const plan = process.env.HF_PROVISION_PLAN ?? '.hf/pipeline/railway-plan.json'
  mkdirSync(dirname(plan), { recursive: true })
  const planned = await railway(['config', 'plan', '--detailed-exit-code', '--out', plan])
  if (planned === PLAN.CURRENT) {
    process.stdout.write('railway.ts is applied\n')
    return
  }
  if (planned !== PLAN.CHANGED) throw new Error(`railway config plan exited ${planned}`)
  // why: applying the pinned plan lands exactly what the log above shows, and fails when the environment moved since it was made
  // why: --confirm-destructive is never passed, so a plan that deletes anything fails here and is applied by hand
  const applied = await railway(['config', 'apply', '--plan', plan, '--json'])
  if (applied !== 0) throw new Error(`railway config apply exited ${applied}`)
  process.stdout.write('applied railway.ts\n')
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
