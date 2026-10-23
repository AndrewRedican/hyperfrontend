/**
 * Every library the documentation site's content lists has its page, its navigation link, its
 * generator entry and, for a core or supporting library, its slug in the generator's table.
 *
 * @module rules/workspace/docs-site-routes
 */

import type { Node } from '@hyperfrontend/linter'
import { existsSync } from 'node:fs'
import { join, posix } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { navigationLink, pagesDirectory, readSiteFile, siteListingListeners } from './shared/docs-site.ts'

export default defineRule<undefined, Node>({
  id: 'workspace/docs-site-routes',
  language: 'code',
  fixable: false,
  create(context) {
    return siteListingListeners(context, ({ root, entries }) => {
      const navigation = readSiteFile(root, 'apps/docs-site/src/lib/navigation.ts')
      const generator = readSiteFile(root, 'apps/docs-site/scripts/generate-docs.ts')
      for (const entry of entries) {
        const label = `Library '${entry.name}' (slug: '${entry.slug}')`
        const report = (message: string): void =>
          context.report({ start: entry.node.start, end: entry.node.end, message: `${label} ${message}` })
        const page = posix.join(pagesDirectory(entry), 'page.tsx')
        if (!existsSync(join(root, page))) report(`is missing required page.tsx at ${page}`)
        const link = navigationLink(entry)
        if (navigation !== null && !navigation.includes(link)) report(`is missing navigation entry '${link}' in navigation.ts`)
        if (generator === null) continue
        if (entry.packageName !== null && !generator.includes(`packageName: '${entry.packageName}'`))
          report('is missing from LIBRARIES array in generate-docs.ts')
        const key = entry.slug.includes('-') ? `'${entry.slug}'` : entry.slug
        if ((entry.category === 'core' || entry.category === 'supporting') && !generator.includes(`${key}: '${entry.slug}'`)) {
          report('is missing from LIBRARY_SLUGS in generate-docs.ts')
        }
      }
    })
  },
})
