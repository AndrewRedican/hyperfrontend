#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { logger } from '@hyperfrontend/logging'
import { LIBRARIES } from '../src/lib/content'
import { createNpmClient } from '../src/lib/npm-downloads/client'
import { NpmStatsError } from '../src/lib/npm-downloads/model'
import { refreshDownloads } from '../src/lib/npm-downloads/refresh'

logger.setLogLevel('log')

const WORKSPACE_ROOT = resolve(__dirname, '../../..')

/** Where the collected history lives, committed beside the site that renders it. */
const DATASET_DIR = resolve(__dirname, '../data/npm-downloads')

/** The one field of a package manifest this script reads. */
interface PackageManifest {
  /** Whether the package is withheld from the registry */
  private?: boolean
}

/** How the script was asked to run. */
interface RunMode {
  /** Ask npm even when the dataset was already refreshed today */
  force: boolean
  /** Whether this is the production build's run, which never fails the build */
  deployment: boolean
}

/**
 * Every documented package that is published, in the order the site lists them.
 *
 * Read from the same library list the site renders, with each package's own
 * manifest consulted for the `private` flag, so a package withheld from the
 * registry is never asked about and a newly published one is tracked from
 * the next refresh without a second list to update.
 *
 * @returns Full npm package names
 */
function publishedPackages(): string[] {
  return LIBRARIES.filter((library) => {
    const manifest = parse(readFileSync(join(WORKSPACE_ROOT, dirname(library.readmePath), 'package.json'), 'utf8')) as PackageManifest
    return manifest.private !== true
  }).map((library) => library.packageName)
}

/**
 * Read the mode off the command line.
 *
 * `--force` asks npm even when the dataset was refreshed earlier today.
 * `--deployment` is the production build's mode: it does nothing outside a
 * Vercel production build, always asks npm when it does run, and turns a
 * failure into a warning rather than an exit code, so the site is built from
 * the committed records whenever npm cannot be reached.
 *
 * @param argv - The process arguments
 * @returns Whether to ask npm regardless of the last refresh, and whether the run may fail the build
 */
function readMode(argv: readonly string[]): RunMode {
  const deployment = argv.includes('--deployment')
  return { deployment, force: deployment || argv.includes('--force') }
}

/**
 * Whether this process is a Vercel production build.
 *
 * Vercel sets `VERCEL_ENV` on every build it runs: `production` for the
 * branch the site is served from and `preview` for everything else. A local
 * build and a CI build carry no such variable, so they never reach npm.
 *
 * @returns True inside a production build
 */
function isProductionBuild(): boolean {
  return process.env['VERCEL_ENV'] === 'production'
}

/**
 * Refresh the committed npm download history.
 *
 * Runs one request at a time with a pause after each, validates every
 * answer, and writes nothing unless the whole run succeeds.
 *
 * @param mode - How the run was asked for
 */
async function refresh(mode: RunMode): Promise<void> {
  const packages = publishedPackages()
  logger.log(`📈 Refreshing npm download history for ${packages.length} packages${mode.force ? ' (forced)' : ''}...\n`)

  const client = createNpmClient({ onProgress: (message) => logger.log(message) })
  const result = await refreshDownloads({
    dir: DATASET_DIR,
    packages,
    client,
    now: dateNow(),
    force: mode.force,
    onProgress: (message) => logger.log(message),
  })

  logger.log('')
  switch (result.outcome) {
    case 'not-due':
      logger.log('⏭  Skipped: the dataset was already refreshed today. Pass --force to refresh anyway.')
      break
    case 'up-to-date':
      logger.log(`✅ Up to date through ${result.frontier} after ${result.requests} requests; nothing changed.`)
      break
    case 'refreshed':
      logger.log(`✅ Refreshed through ${result.frontier} after ${result.requests} requests. Files written:`)
      for (const file of result.changed) logger.log(`   ${file}`)
      break
  }
}

/**
 * Say what went wrong, for the person reading the build log.
 *
 * @param error - Whatever the refresh threw
 */
function report(error: unknown): void {
  if (error instanceof NpmStatsError) {
    logger.error(`\n❌ npm download refresh failed (${error.kind}): ${error.message}`)
  } else {
    logger.error('\n❌ npm download refresh failed:', error)
  }
  logger.error('   Nothing was written; the committed dataset is exactly as it was.')
}

/**
 * Run the refresh in the mode the command line asked for.
 *
 * A production build extends the committed history with the days npm has
 * counted since it was committed, and builds from the committed history
 * alone when that fails, so the site is never taken down by npm being
 * unreachable and never says it is counted through a day it is not.
 */
async function main(): Promise<void> {
  const mode = readMode(process.argv)
  if (mode.deployment && !isProductionBuild()) {
    logger.log('⏭  Not a production build; the committed npm download history is what this build renders.')
    return
  }
  try {
    await refresh(mode)
  } catch (error: unknown) {
    report(error)
    if (mode.deployment) {
      logger.warn('⚠️  Building from the committed dataset instead; the site will report the frontier it was committed with.')
      return
    }
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  logger.error('\n❌ npm download refresh failed:', error)
  process.exit(1)
})
