/**
 * Every secondary entry a listed library's manifest exports has its page and its navigation link
 * on the documentation site.
 *
 * @module rules/workspace/docs-site-secondary-entries
 */

import type { Node } from '../../code/model.ts'
import { existsSync } from 'node:fs'
import { join, posix } from 'node:path'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { defineRule } from '../../engine/rule.ts'
import { navigationLink, pagesDirectory, readSiteFile, siteListingListeners } from './shared/docs-site.ts'
import { readPackageFile } from './shared/project-file.ts'

export default defineRule<undefined, Node>({
  id: 'workspace/docs-site-secondary-entries',
  language: 'code',
  fixable: false,
  create(context) {
    return siteListingListeners(context, ({ root, entries }) => {
      const navigation = readSiteFile(root, 'apps/docs-site/src/lib/navigation.ts')
      for (const entry of entries) {
        if (entry.readmePath === null) continue
        const exports = readPackageFile(join(root, posix.dirname(entry.readmePath)))?.exports
        if (exports === null || typeof exports !== 'object') continue
        for (const key of keys(exports as Record<string, unknown>)) {
          if (key === '.' || key === './package.json' || !key.startsWith('./') || key.includes('*')) continue
          const subpath = key.slice(2)
          const label = `Library '${entry.name}' secondary entrypoint './${subpath}'`
          const report = (message: string): void =>
            context.report({ start: entry.node.start, end: entry.node.end, message: `${label} ${message}` })
          const page = posix.join(pagesDirectory(entry), subpath, 'page.tsx')
          if (!existsSync(join(root, page))) report(`is missing required page.tsx at ${page}`)
          const link = navigationLink(entry, subpath)
          if (navigation !== null && !navigation.includes(link)) report(`is missing navigation entry '${link}' in navigation.ts`)
        }
      }
    })
  },
})
