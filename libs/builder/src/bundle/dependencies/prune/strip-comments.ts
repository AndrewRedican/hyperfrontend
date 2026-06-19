import ts from 'typescript'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, readFileContent, writeFileContent } from '@hyperfrontend/project-scope/core'
import { walkFiles } from './orphan-chunks'

/**
 * Outcome of the Comment Strip.
 */
export interface CommentStripResult {
  /** Bytes reclaimed by removing ordinary comments from surviving chunks. */
  commentBytesRemoved: number
}

/**
 * Comment text that must survive the strip.
 *
 * - `@__PURE__` / `#__PURE__` / `@__NO_SIDE_EFFECTS__` — tool-agnostic annotations
 *   a downstream bundler reads to tree-shake our published package further;
 *   removing them degrades that.
 * - `@license` / `@preserve` / `@cc_on` and a `/*!` or `//!` legal banner — attribution
 *   that must ship.
 */
const PRESERVE = /@(?:__PURE__|__NO_SIDE_EFFECTS__|license|preserve|cc_on)|^\s*\/[*/]!|#__PURE__/

// why: tokens after which a `/` is the division operator, not a regex opener. After every other token (operators, `(`, `,`, `=`, keywords like `return`/`typeof`, or start of input) a `/` begins a regex, so the scanner must re-lex it as a whole regex literal — otherwise a `//` or `/*` *inside the regex body* (e.g. `/https?:\/\//`, `str.split(/\//g)`) is mis-scanned as comment trivia and the splice corrupts the regex.
const VALUE_END_TOKENS: ReadonlySet<ts.SyntaxKind> = createSet<ts.SyntaxKind>([
  ts.SyntaxKind.Identifier,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.CloseParenToken,
  ts.SyntaxKind.CloseBracketToken,
  ts.SyntaxKind.CloseBraceToken,
  ts.SyntaxKind.PlusPlusToken,
  ts.SyntaxKind.MinusMinusToken,
  ts.SyntaxKind.ThisKeyword,
  ts.SyntaxKind.SuperKeyword,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NullKeyword,
])

/**
 * A half-open `[start, end)` offset range of one comment in a chunk's raw source.
 */
interface CommentRange {
  /** Offset of the comment's first character. */
  start: number
  /** Offset one past the comment's last character. */
  end: number
}

/**
 * Enumerates every comment trivia range in `text` via a `ts.Scanner` over the raw
 * source. The scanner keeps comment-looking text inside strings, templates, and
 * (with regex re-lexing) regex literals bound to those tokens, so the ranges it
 * returns are always genuine comments — never a `//` buried in a string or regex.
 *
 * @param text - Raw chunk source to scan.
 * @returns Every comment trivia range, in ascending source order.
 */
const collectComments = (text: string): CommentRange[] => {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, ts.LanguageVariant.Standard, text)
  const ranges: CommentRange[] = []
  // why: start-of-input is an expression position, so a leading `/` opens a regex.
  let prevSignificant: ts.SyntaxKind = ts.SyntaxKind.Unknown
  // why: ts.Scanner.scan() does not resume a template literal across its `${...}` substitution on its own — it returns the substitution's closing `}` as a bare CloseBraceToken, so the next backtick is mis-lexed as *opening* a string instead of closing the template. That flips backtick polarity for the rest of the file and exposes `//`/`/*` inside later templates as phantom comments. Track each open substitution's brace depth so the `}` that closes one is re-lexed as the template's continuation (TemplateMiddle when another `${` follows, TemplateTail when the backtick closes); a depth>0 brace is an ordinary block/object brace inside the expression and is left alone.
  const templateBraceDepths: number[] = []
  let token = scanner.scan()
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    const inSubstitution = templateBraceDepths.length > 0
    if ((token === ts.SyntaxKind.SlashToken || token === ts.SyntaxKind.SlashEqualsToken) && !VALUE_END_TOKENS.has(prevSignificant)) {
      // why: a `/` in expression position is a regex; re-lex the whole literal so its body is never tokenized into stray comments. reScanSlashToken returns the original SlashToken when no valid regex closes on the line, which leaves a true division untouched.
      token = scanner.reScanSlashToken()
    } else if (token === ts.SyntaxKind.CloseBraceToken && inSubstitution && templateBraceDepths[templateBraceDepths.length - 1] === 0) {
      // why: this `}` closes the innermost `${...}`; re-lex it as the template's continuation so the trailing backtick is scanned as template text, not a fresh string opener.
      token = scanner.reScanTemplateToken(/*isTaggedTemplate*/ false)
    }
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      ranges.push({ start: scanner.getTokenStart(), end: scanner.getTextPos() })
    } else if (token !== ts.SyntaxKind.WhitespaceTrivia && token !== ts.SyntaxKind.NewLineTrivia) {
      // why: comments and whitespace don't change whether the next `/` is division or regex; only real tokens do.
      prevSignificant = token
    }
    // why: maintain the substitution-depth stack after re-lexing so each token's effect (open a substitution, descend/ascend a nested brace, or close the template) is counted once.
    if (token === ts.SyntaxKind.TemplateHead) templateBraceDepths.push(0)
    else if (token === ts.SyntaxKind.TemplateTail) templateBraceDepths.pop()
    else if (inSubstitution && token === ts.SyntaxKind.OpenBraceToken) templateBraceDepths[templateBraceDepths.length - 1]++
    else if (inSubstitution && token === ts.SyntaxKind.CloseBraceToken) templateBraceDepths[templateBraceDepths.length - 1]--
    token = scanner.scan()
  }
  return ranges
}

const isBlankSlice = (text: string, from: number, to: number): boolean => /^[ \t]*$/.test(text.slice(from, to))

const lineStartOf = (text: string, pos: number): number => text.lastIndexOf('\n', pos - 1) + 1

const nextNewline = (text: string, pos: number): number => {
  const nl = text.indexOf('\n', pos)
  return nl === -1 ? text.length : nl
}

/**
 * Expands a bare comment range to the removal range actually spliced out.
 *
 * A comment that occupies a whole line (only whitespace before it on the line and
 * only whitespace after it up to the newline) is removed line-and-all, then any
 * immediately following blank lines are swallowed so contiguous JSDoc/banner
 * removals collapse without leaving blank-line residue. An inline comment is
 * removed verbatim. Blank-line swallowing is template-safe by construction:
 * comments only exist in code context, so the lines adjacent to a removed comment
 * are never inside a string or template literal.
 *
 * @param text - Raw chunk source the comment was found in.
 * @param comment - The bare comment range to expand.
 * @returns The offset range to splice out for this comment.
 */
const removalRange = (text: string, comment: CommentRange): CommentRange => {
  const lineStart = lineStartOf(text, comment.start)
  const eol = nextNewline(text, comment.end)
  const wholeLine = isBlankSlice(text, lineStart, comment.start) && isBlankSlice(text, comment.end, eol)
  if (!wholeLine) return comment
  let to = eol < text.length ? eol + 1 : eol
  while (to < text.length) {
    const nl = nextNewline(text, to)
    if (!isBlankSlice(text, to, nl)) break
    to = nl < text.length ? nl + 1 : nl
  }
  return { start: lineStart, end: to }
}

/**
 * Strips ordinary comments from `source`, preserving `@__PURE__` /
 * `@__NO_SIDE_EFFECTS__` and legal comments. Returns the rewritten text, or
 * `null` when there is nothing removable (leaving the file untouched and the pass
 * idempotent on a second run).
 *
 * @param source - Raw chunk source to strip.
 * @returns The rewritten source, or `null` when nothing is removable.
 *
 * @example Stripping a chunk's JSDoc while keeping its `@__PURE__` annotations
 * ```typescript
 * const stripped = stripComments(readFileContent(chunk))
 * if (stripped !== null) writeFileContent(chunk, stripped)
 * ```
 */
export const stripComments = (source: string): string | null => {
  const removable = collectComments(source).filter((range) => !PRESERVE.test(source.slice(range.start, range.end)))
  if (removable.length === 0) return null
  const ranges = removable.map((comment) => removalRange(source, comment))
  // why: splice from the back so each earlier (smaller) offset stays valid; the ranges are disjoint and ascending, so descending removal never disturbs a not-yet-applied offset.
  let out = source
  for (let i = ranges.length - 1; i >= 0; i--) out = out.slice(0, ranges[i].start) + out.slice(ranges[i].end)
  return out
}

/**
 * Comment Strip: removes ordinary comments — source banners, `eslint-disable`
 * pragmas, and full JSDoc — from every surviving `_dependencies/**` runtime chunk
 * while preserving `@__PURE__` / `@__NO_SIDE_EFFECTS__` annotations and legal
 * comments.
 *
 * Consumers read the package's public `index.d.ts`, never `_dependencies/**\/*.js`,
 * so these comments are pure runtime bytes — but the annotations a downstream
 * bundler uses to tree-shake our package and the legal comments it must surface
 * really do ship inside the chunks, so the strip is a comment-aware text splice
 * (no minify, no reformat), not a blanket removal. A `ts.Scanner` enumerates
 * genuine comment trivia, keeping comment-looking text inside strings, templates,
 * and regex literals untouched. One chunk is resident at a time — no second
 * `ts.SourceFile`, no `ts.Program`, no rollup re-run.
 *
 * @param depsRoot - Absolute path to the `_dependencies/` directory.
 * @returns Bytes reclaimed across all chunks.
 *
 * @example Stripping comments after the prune passes
 * ```typescript
 * const { commentBytesRemoved } = stripCommentsPass(join(context.outputPath, '_dependencies'))
 * ```
 */
export const stripCommentsPass = (depsRoot: string): CommentStripResult => {
  const result: CommentStripResult = { commentBytesRemoved: 0 }
  if (!exists(depsRoot)) return result
  const chunks: string[] = []
  walkFiles(depsRoot, (name) => name === 'index.esm.js' || name === 'index.cjs.js', chunks)
  for (const chunk of chunks) {
    const source = readFileContent(chunk)
    const stripped = stripComments(source)
    if (stripped === null) continue
    writeFileContent(chunk, stripped)
    result.commentBytesRemoved += Buffer.byteLength(source) - Buffer.byteLength(stripped)
  }
  return result
}
