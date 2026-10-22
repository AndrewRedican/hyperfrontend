/**
 * The reference token stream of a file: the leaves of the TypeScript compiler's syntax tree,
 * which carry the rescanned regex, template and JSX tokens a plain scanner cannot produce, and
 * the comment ranges between them. Only `parser-oracle.ts` loads this module; the compiler is a
 * development oracle, not a dependency of the linter.
 *
 * @module scripts/lib/reference-tokens
 */

import ts from 'typescript'

/** A token's category, coarse enough to compare across two scanners. */
export type TokenCategory = 'word' | 'number' | 'string' | 'template' | 'regex' | 'jsxtext' | 'punct'

/** One token. */
export interface ReferenceToken {
  /** Which kind of token it is. */
  readonly category: TokenCategory
  /** The offset of its first character. */
  readonly start: number
  /** The offset after its last character. */
  readonly end: number
}

/** One comment. */
export interface ReferenceComment {
  /** The offset of its first character, the `/`. */
  readonly start: number
  /** The offset after its last character. */
  readonly end: number
  /** True for a block comment, false for a line comment. */
  readonly block: boolean
}

/** What the reference produced for a file. */
export interface ReferenceScan {
  /** The tokens in source order, without the end-of-file token. */
  readonly tokens: readonly ReferenceToken[]
  /** The comments in source order. */
  readonly comments: readonly ReferenceComment[]
  /** How many syntax errors the compiler reported. */
  readonly errors: number
}

/** The parser's diagnostics, which the public `SourceFile` type leaves out. */
interface ParsedFile {
  /** One entry per syntax error. */
  readonly parseDiagnostics: readonly unknown[]
}

/**
 * Scans a file with the compiler.
 *
 * @param text - The file's text
 * @param extension - Its extension with the dot, which selects TSX, TS or JS parsing
 * @returns Tokens, comments and the error count
 */
export function referenceScan(text: string, extension: string): ReferenceScan {
  const kind = extension === '.tsx' ? ts.ScriptKind.TSX : extension === '.ts' ? ts.ScriptKind.TS : ts.ScriptKind.JS
  const file = ts.createSourceFile(`reference${extension}`, text, ts.ScriptTarget.Latest, true, kind)
  const tokens: ReferenceToken[] = []
  const collect = (node: ts.Node): void => {
    // why: with parent nodes set, the children of a node include its JSDoc, whose tags and text are not tokens of the file.
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return
    const children = node.getChildren(file)
    if (children.length > 0) {
      for (const child of children) collect(child)
      return
    }
    if (node.kind === ts.SyntaxKind.EndOfFileToken) return
    const start = node.kind === ts.SyntaxKind.JsxText ? node.pos : node.getStart(file)
    if (start === node.end) return
    tokens.push({ category: categoryOf(node.kind), start, end: node.end })
  }
  collect(file)
  // why: the parser's diagnostics are not on the public SourceFile type, and building a program to ask getPreEmitDiagnostics would type-check every file; this script is development tooling.
  return { tokens, comments: commentsBetween(text, tokens), errors: (file as unknown as ParsedFile).parseDiagnostics.length }
}

/**
 * The category of a token kind.
 *
 * @param kind - The compiler's syntax kind of a leaf node
 * @returns The coarse category the comparison uses
 */
function categoryOf(kind: ts.SyntaxKind): TokenCategory {
  switch (kind) {
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.BigIntLiteral:
      return 'number'
    case ts.SyntaxKind.StringLiteral:
      return 'string'
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
    case ts.SyntaxKind.TemplateHead:
    case ts.SyntaxKind.TemplateMiddle:
    case ts.SyntaxKind.TemplateTail:
      return 'template'
    case ts.SyntaxKind.RegularExpressionLiteral:
      return 'regex'
    case ts.SyntaxKind.JsxText:
    case ts.SyntaxKind.JsxTextAllWhiteSpaces:
      return 'jsxtext'
    default:
      return kind >= ts.SyntaxKind.FirstPunctuation && kind <= ts.SyntaxKind.LastPunctuation ? 'punct' : 'word'
  }
}

/**
 * The comments in the trivia before each token and after the last one.
 *
 * @param text - The file's text
 * @param tokens - The tokens in source order, whose gaps hold the comments
 * @returns The comments in source order
 */
function commentsBetween(text: string, tokens: readonly ReferenceToken[]): ReferenceComment[] {
  const comments: ReferenceComment[] = []
  let position = 0
  // why: the compiler splits the comments between two tokens into those on the previous token's line and those after a line break; both are comments of the file.
  const take = (end: number): void => {
    const ranges = [...(ts.getTrailingCommentRanges(text, position) ?? []), ...(ts.getLeadingCommentRanges(text, position) ?? [])]
    for (const range of ranges) {
      if (range.pos >= end || comments.some((comment) => comment.start === range.pos)) continue
      comments.push({ start: range.pos, end: range.end, block: range.kind === ts.SyntaxKind.MultiLineCommentTrivia })
    }
  }
  for (const token of tokens) {
    if (token.start > position) take(token.start)
    position = token.end
  }
  take(text.length)
  return comments
}
