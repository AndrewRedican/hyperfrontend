/**
 * A triple-slash reference pulls a file or a types package into the program from a comment,
 * where an import would be explicit: a `path` reference is reported, a `types` reference
 * once for every import of the same module, and a `lib` reference passes, as nothing imports
 * a lib. Only references before the first statement are directives.
 *
 * @module rules/typescript/triple-slash-reference
 */

import type { Node } from '../../code/model'
import type { SourceComment } from '../../config/directives'
import { commentsBetween } from '../../code/source'
import { defineRule } from '../../engine/rule'

/** A `types` reference waiting for an import of its module. */
interface TypesReference {
  /** The comment. */
  readonly comment: SourceComment
  /** The module named. */
  readonly module: string
}

/** A reference directive in a line comment's text: the third slash, the tag, one attribute, the quoted name. */
const REFERENCE = /^\/\s*<reference\s*(?<attribute>types|path|lib)\s*=\s*["'](?<module>[^"']*)/

export default defineRule<undefined, Node>({
  id: 'typescript/triple-slash-reference',
  language: 'code',
  fixable: false,
  create(context) {
    const { file } = context
    const pending: TypesReference[] = []
    const report = (comment: SourceComment, module: string): void => {
      context.report({
        start: comment.start,
        end: comment.end,
        message: `Do not use a triple slash reference for ${module}, use \`import\` style instead.`,
      })
    }
    const matchImport = (source: Node): void => {
      for (const reference of pending) if (reference.module === source.value) report(reference.comment, reference.module)
    }
    return {
      Program(node) {
        for (const comment of commentsBetween(file, 0, node.start)) {
          if (file.text[comment.start + 1] === '*') continue
          const match = REFERENCE.exec(comment.text)
          if (match === null) continue
          const { attribute, module } = match.groups as Record<string, string>
          if (attribute === 'path') report(comment, module)
          else if (attribute === 'types') pending.push({ comment, module })
        }
      },
      ImportDeclaration(node) {
        matchImport(node.source as Node)
      },
      TSImportEqualsDeclaration(node) {
        const reference = node.moduleReference as Node
        if (reference.kind === 'TSExternalModuleReference') matchImport(reference.expression as Node)
      },
    }
  },
})
