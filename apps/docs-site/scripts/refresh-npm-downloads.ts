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
 * Refresh the committed npm download history.
 *
 * Runs one request at a time with a pause after each, validates every
 * answer, and writes nothing unless the whole run succeeds. Pass `--force`
 * to run even when the dataset was already refreshed today.
 */
async function main(): Promise<void> {
  const force = process.argv.includes('--force')
  const packages = publishedPackages()
  logger.log(`📈 Refreshing npm download history for ${packages.length} packages${force ? ' (forced)' : ''}...\n`)

  const client = createNpmClient({ onProgress: (message) => logger.log(message) })
  const result = await refreshDownloads({
    dir: DATASET_DIR,
    packages,
    client,
    now: dateNow(),
    force,
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

main().catch((error: unknown) => {
  if (error instanceof NpmStatsError) {
    logger.error(`\n❌ npm download refresh failed (${error.kind}): ${error.message}`)
    logger.error('   Nothing was written; the committed dataset is exactly as it was.')
  } else {
    logger.error('\n❌ npm download refresh failed:', error)
  }
  process.exit(1)
})
