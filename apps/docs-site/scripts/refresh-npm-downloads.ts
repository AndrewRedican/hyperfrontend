#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { logger } from '@hyperfrontend/logging'
import { LIBRARIES } from '../src/lib/content'
import { extendDataset } from '../src/lib/npm-downloads/extend'
import { NpmStatsError } from '../src/lib/npm-downloads/model'
import { STATISTICS_ORIGIN } from '../src/lib/site'

logger.setLogLevel('log')

const WORKSPACE_ROOT = resolve(__dirname, '../../..')

/** Where the collected history lives, committed beside the site that renders it. */
const DATASET_DIR = resolve(__dirname, '../data/npm-downloads')

/** The one field of a package manifest this script reads. */
interface PackageManifest {
  /** Whether the package is withheld from the registry */
  private?: boolean
  /** The version on disk; `0.0.0` until the first release */
  version?: string
}

/**
 * Every documented package that is published, in the order the site lists them.
 *
 * Read from the same library list the site renders, with each package's own
 * manifest consulted for the `private` flag and the version, so a package
 * withheld from the registry, or still at `0.0.0` before its first release, is
 * never asked about, and a newly published one is tracked from the next
 * refresh without a second list to update.
 *
 * @returns Full npm package names
 */
function publishedPackages(): string[] {
  return LIBRARIES.filter((library) => {
    const manifest = parse(readFileSync(join(WORKSPACE_ROOT, dirname(library.readmePath), 'package.json'), 'utf8')) as PackageManifest
    return manifest.private !== true && manifest.version !== '0.0.0'
  }).map((library) => library.packageName)
}

/**
 * Whether the command line asks for the production build's mode.
 *
 * `--deployment` does nothing outside a Vercel production build, and inside
 * one turns a failure into a warning rather than an exit code, so the site is
 * built from the committed records whenever the statistics service cannot be
 * reached.
 *
 * @param argv - The process arguments
 * @returns True when the run must never fail the build
 */
function isDeploymentRun(argv: readonly string[]): boolean {
  return argv.includes('--deployment')
}

/**
 * Whether this process is a Vercel production build.
 *
 * Vercel sets `VERCEL_ENV` on every build it runs: `production` for the
 * branch the site is served from and `preview` for everything else. A local
 * build and a CI build carry no such variable, so they never ask the
 * statistics service.
 *
 * @returns True inside a production build
 */
function isProductionBuild(): boolean {
  return process.env['VERCEL_ENV'] === 'production'
}

/**
 * Extend the committed npm download history from the statistics service.
 *
 * One request, validated whole, and nothing is written unless the whole run
 * succeeds.
 */
async function refresh(): Promise<void> {
  const packages = publishedPackages()
  logger.log(`📈 Extending npm download history for ${packages.length} packages from the statistics service at ${STATISTICS_ORIGIN}...\n`)

  const result = await extendDataset({
    dir: DATASET_DIR,
    packages,
    origin: STATISTICS_ORIGIN,
    fetch: (url, init) => fetch(url, init),
    now: dateNow(),
    onProgress: (message) => logger.log(message),
  })

  logger.log('')
  switch (result.outcome) {
    case 'up-to-date':
      logger.log(`✅ Up to date through ${result.frontier}; nothing changed.`)
      break
    case 'refreshed':
      logger.log(`✅ Refreshed through ${result.frontier}. Files written:`)
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
    logger.error(`\n❌ npm download refresh from the statistics service failed (${error.kind}): ${error.message}`)
  } else {
    logger.error('\n❌ npm download refresh from the statistics service failed:', error)
  }
  logger.error('   Nothing was written; the committed dataset is exactly as it was.')
}

/**
 * Run the refresh in the mode the command line asked for.
 *
 * A production build extends the committed history with the days the
 * statistics service has collected since it was committed, and builds from
 * the committed history alone when that fails, so the site is never taken
 * down by the service being unreachable and never says it is counted through
 * a day it is not.
 */
async function main(): Promise<void> {
  const deployment = isDeploymentRun(process.argv)
  if (deployment && !isProductionBuild()) {
    logger.log('⏭  Not a production build; the committed npm download history is what this build renders.')
    return
  }
  try {
    await refresh()
  } catch (error: unknown) {
    report(error)
    if (deployment) {
      logger.warn('⚠️  Building from the committed dataset instead; the site will report the frontier it was committed with.')
      return
    }
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  logger.error('\n❌ npm download refresh from the statistics service failed:', error)
  process.exit(1)
})
