/**
 * A code example in Markdown uses API that exists. What a fenced TypeScript or JavaScript block,
 * or the script of an HTML block, takes from a workspace package is exported by the entry point
 * it names; and in a package's own documentation, a function an example calls at its top level
 * is provided by something: the example, the platform, or a workspace package.
 *
 * @module rules/workspace/markdown-example-api
 */

import type { MarkdownNode } from '@hyperfrontend/linter'
import type { Example } from './shared/example-api.ts'
import { basename, dirname, join } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { workspaceRootOf } from '@hyperfrontend/workspace/lint'
import { docsIndex, packageOfFile } from './shared/docs-catalog.ts'
import { EXTENSIONS, checkExample, partOf } from './shared/example-api.ts'

/** An inline script of an HTML block: one that carries its code, not the address of a file. */
const INLINE_SCRIPT = /<script(?![^>]*\ssrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi

export default defineRule<undefined, MarkdownNode>({
  id: 'workspace/markdown-example-api',
  language: 'markdown',
  fixable: false,
  create(context) {
    const path = context.file.path
    if (!path.endsWith('.md') || basename(path) === 'CHANGELOG.md') return {}
    const root = workspaceRootOf(dirname(path))
    if (root === null) return {}
    const index = docsIndex(root, join(root, 'apps/docs-site'))
    const own = packageOfFile(index, path)
    const report = (start: number, end: number, message: string): void => context.report({ start, end, message })
    return {
      code(block) {
        const language = (block.lang ?? '').toLowerCase()
        const extension = EXTENSIONS[language]
        if (extension === undefined && language !== 'html') return
        const text = block.value as string
        // why: a fence inside a list or a quote loses its indentation in the block's text, so each line is found again in the file's own line.
        const lineStarts = text
          .split(/\r?\n/)
          .map((line, row) => context.file.text.indexOf(line, context.file.lines.starts[block.position.start.line + row] as number))
        const whole: Example = { text, extension: extension ?? '.html', lineStarts, own }
        if (extension !== undefined) checkExample(index, whole, report)
        else {
          // why: a page that loads a bundle from a CDN reads the package off a global, and that script is as much an example of the API as a module is.
          for (const script of text.matchAll(INLINE_SCRIPT)) {
            const from = script.index + script[0].indexOf('>') + 1
            checkExample(index, partOf(whole, from, from + (script[1] as string).length, '.js'), report)
          }
        }
      },
    }
  },
})
