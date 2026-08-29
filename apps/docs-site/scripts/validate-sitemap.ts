#!/usr/bin/env node
import { resolve, join, dirname } from 'node:path'
import { glob } from 'glob'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { logger } from '@hyperfrontend/logging'
import sitemap from '../src/app/sitemap'

logger.setLogLevel('log')

const APP_DIR = join(resolve(__dirname, '..'), 'src', 'app')

/**
 * Routes deliberately absent from the sitemap. Keep this list minimal — every
 * entry needs a reason.
 */
const SITEMAP_EXEMPT_ROUTES = createSet([
  // why: /docs/api/ is a noindex meta-refresh redirect stub, so listing it in the sitemap would be self-contradictory
  '/docs/api/',
  // why: the fit assessment result renders from an assessment held in the reader's own browser, so it is noindex and has nothing stable for a crawler to fetch
  '/docs/is-hyperfrontend-right-for-you/result/',
])

/**
 * Enumerate every static route the filesystem defines, as trailing-slash
 * paths. Dynamic segments (e.g. `[slug]`) are skipped because their concrete
 * URLs cannot be derived from the filesystem alone.
 *
 * @returns Sorted array of route paths (e.g. '/', '/docs/quick-start/')
 */
async function collectFilesystemRoutes(): Promise<string[]> {
  const pageFiles = await glob('**/page.tsx', { cwd: APP_DIR })
  return pageFiles
    .filter((file) => !file.includes('['))
    .map((file) => {
      const dir = dirname(file)
      return dir === '.' ? '/' : `/${dir}/`
    })
    .sort()
}

/**
 * Fail the build when a filesystem route is missing from the sitemap, so new
 * pages cannot silently ship unindexed.
 */
async function validateSitemap(): Promise<void> {
  logger.log('🗺️  Validating sitemap route coverage...\n')

  const sitemapPaths = createSet(
    sitemap().map((entry) => {
      const { pathname } = createURL(entry.url)
      return pathname.endsWith('/') ? pathname : `${pathname}/`
    })
  )

  const routes = await collectFilesystemRoutes()
  const missing = routes.filter((route) => !sitemapPaths.has(route) && !SITEMAP_EXEMPT_ROUTES.has(route))

  logger.log(`📄 Filesystem routes: ${routes.length}`)
  logger.log(`🔗 Sitemap URLs:      ${sitemapPaths.size}\n`)

  if (missing.length > 0) {
    logger.error('❌ Routes missing from the sitemap:')
    for (const route of missing) {
      logger.error(`  ${route}`)
    }
    logger.error('\nAdd the route to the navigation data or the static page list in src/app/sitemap.ts.')
    process.exit(1)
  }

  logger.log('✅ Every filesystem route is covered by the sitemap!')
}

if (require.main === module) {
  validateSitemap().catch((err) => {
    logger.error('Sitemap validation failed:', err)
    process.exit(1)
  })
}

export { validateSitemap }
