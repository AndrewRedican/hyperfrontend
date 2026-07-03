import type { FormatOutputs } from '../models'
import type { CommentStripResult } from './dependencies/prune/strip-comments'
import { logger } from '@hyperfrontend/logging'
import { join, readFileContent, writeFileContent } from '@hyperfrontend/project-scope/core'
import { stripComments } from './dependencies/prune/strip-comments'

const log = logger.channel('builder:bundle:strip-comments')

const stripFile = (file: string, result: CommentStripResult): void => {
  const source = readFileContent(file)
  const stripped = stripComments(source)
  if (stripped === null) return
  writeFileContent(file, stripped)
  result.commentBytesRemoved += Buffer.byteLength(source) - Buffer.byteLength(stripped)
}

/**
 * Post-emit comment strip over the non-minified IIFE/UMD bundle outputs.
 *
 * The unminified `index.iife.js` / `index.umd.js` files keep their source
 * comments verbatim (only the `.min` twins pass through terser), so internal
 * lint pragmas and JSDoc would otherwise ship inside them. This pass rewrites
 * each of those files with {@link stripComments}, keeping `@__PURE__` /
 * `@__NO_SIDE_EFFECTS__` annotations and legal comments intact. Minified twins
 * are never touched, and any output built with `sourcemap: true` is skipped
 * because the text splice would invalidate its emitted `.map`.
 *
 * @param outputPath - Absolute path to the package's output directory.
 * @param outputs - Per-format outputs recorded by the bundle phase.
 * @returns Bytes reclaimed across all rewritten bundle files.
 *
 * @example Stripping bundle comments right after the IIFE/UMD formats run
 * ```typescript
 * const { commentBytesRemoved } = stripBundleCommentsPass(context.outputPath, outputs)
 * ```
 */
export const stripBundleCommentsPass = (outputPath: string, outputs: FormatOutputs): CommentStripResult => {
  const result: CommentStripResult = { commentBytesRemoved: 0 }
  for (const { config } of outputs.iife) {
    if (config.sourcemap) continue
    stripFile(join(outputPath, config.output ?? 'bundle', 'index.iife.js'), result)
  }
  for (const { config } of outputs.umd) {
    if (config.sourcemap) continue
    stripFile(join(outputPath, config.output ?? 'bundle', 'index.umd.js'), result)
  }
  if (result.commentBytesRemoved > 0) {
    log.info(`bundle comment strip: removed ${result.commentBytesRemoved} bytes from iife/umd outputs`)
  }
  return result
}
