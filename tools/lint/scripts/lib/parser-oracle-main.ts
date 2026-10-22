/**
 * Compares the new scanner with the compiler over every tracked code file: the token stream
 * (category, start, end), the comments, and whether the file parses.
 *
 * The subject module must export `scan(text, extension)` returning `{ tokens, comments, error }`
 * with the shapes of `reference-tokens.ts`; until it exists the script reports that and exits 2.
 *
 * @module scripts/lib/parser-oracle-main
 */

import type { ReferenceComment, ReferenceScan, ReferenceToken } from './reference-tokens.ts'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { LINT_ROOT, WORKSPACE_ROOT, labelDir, say } from './paths.ts'

/** What the subject must return. */
interface SubjectScan {
  /** The tokens in source order, without the end-of-file token. */
  readonly tokens: readonly ReferenceToken[]
  /** The comments in source order. */
  readonly comments: readonly ReferenceComment[]
  /** A parse error message, or null when the file parses. */
  readonly error: string | null
}

/** The subject module's surface. */
interface SubjectModule {
  /** Scans a text as a file with the given extension. */
  readonly scan: (text: string, extension: string) => SubjectScan
}

/** One text to compare. */
interface Input {
  /** What the comparison calls it. */
  readonly id: string
  /** The path whose extension decides the dialect. */
  readonly path: string
  /** The text, or null to read the path. */
  readonly text: string | null
}

/** A corpus input as the oracle wrote it. */
interface CorpusInput {
  /** The input's id. */
  readonly id: string
  /** The path it was derived from. */
  readonly path: string
  /** The text. */
  readonly text: string
}

/**
 * Runs the script.
 *
 * @param argv - `[--subject path] [--limit n] [--filter substring] [--corpus label]`, which scanner to test and over which files; a corpus label compares the oracle's inputs instead of the tracked files
 */
export async function main(argv: readonly string[]): Promise<void> {
  const option = (name: string, fallback: string): string => {
    const at = argv.indexOf(name)
    return at === -1 ? fallback : (argv[at + 1] ?? fallback)
  }
  const subjectPath = resolve(WORKSPACE_ROOT, option('--subject', join(LINT_ROOT, 'src', 'code', 'parse.ts')))
  const limit = parseInt(option('--limit', '0'), 10)
  const filter = option('--filter', '')
  let subject: SubjectModule
  try {
    subject = (await import(pathToFileURL(subjectPath).href)) as SubjectModule
  } catch (error) {
    say(`subject not available: ${subjectPath}\n${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 2
    return
  }
  const { referenceScan } = await import('./reference-tokens.ts')
  const corpus = option('--corpus', '')
  const inputs: Input[] =
    corpus === ''
      ? execFileSync('git', ['ls-files', '--', '*.ts', '*.tsx', '*.js', '*.mjs', '*.cjs'], { cwd: WORKSPACE_ROOT, encoding: 'utf8' })
          .split(/\r?\n/)
          .filter((path) => path !== '')
          .map((path) => ({ id: path, path, text: null }))
      : (parse(readFileSync(join(labelDir(corpus), 'inputs.json'), 'utf8')) as CorpusInput[])
          .filter((input) => /\.(ts|tsx|js|mjs|cjs)$/.test(input.path))
          .map((input) => ({ id: input.id, path: input.path, text: input.text }))
  const files = inputs.filter((input) => input.id.includes(filter))
  const compared = limit > 0 ? files.slice(0, limit) : files
  let differing = 0
  let shown = 0
  for (const input of compared) {
    const path = input.id
    const text = input.text ?? readFileSync(join(WORKSPACE_ROOT, input.path), 'utf8')
    const difference = firstDifference(referenceScan(text, extname(input.path)), subject.scan(text, extname(input.path)), text)
    if (difference === null) continue
    differing += 1
    if (shown < 20) {
      shown += 1
      say(`${path}: ${difference}`)
    }
  }
  say(`${compared.length} files compared, ${differing} differ`)
  process.exitCode = differing === 0 ? 0 : 1
}

/**
 * The first place two scans disagree.
 *
 * @param reference - The compiler's scan, which defines what is correct
 * @param subject - The new scanner's scan of the same text
 * @param text - The file's text, quoted in the description
 * @returns A description, or null when they agree
 */
function firstDifference(reference: ReferenceScan, subject: SubjectScan, text: string): string | null {
  if (reference.errors > 0 !== (subject.error !== null)) {
    return `parse verdict differs: compiler errors ${reference.errors}, subject ${subject.error ?? 'parses'}`
  }
  const count = reference.tokens.length < subject.tokens.length ? reference.tokens.length : subject.tokens.length
  for (let index = 0; index < count; index += 1) {
    const expected = reference.tokens[index]
    const actual = subject.tokens[index]
    if (expected.category !== actual.category || expected.start !== actual.start || expected.end !== actual.end) {
      return `token ${index}: expected ${expected.category} ${expected.start}-${expected.end} ${show(text, expected)}, got ${actual.category} ${actual.start}-${actual.end} ${show(text, actual)}`
    }
  }
  if (reference.tokens.length !== subject.tokens.length)
    return `token count: expected ${reference.tokens.length}, got ${subject.tokens.length}`
  const comments = reference.comments.length < subject.comments.length ? reference.comments.length : subject.comments.length
  for (let index = 0; index < comments; index += 1) {
    const expected = reference.comments[index]
    const actual = subject.comments[index]
    if (expected.start !== actual.start || expected.end !== actual.end || expected.block !== actual.block) {
      return `comment ${index}: expected ${expected.start}-${expected.end}, got ${actual.start}-${actual.end}`
    }
  }
  if (reference.comments.length !== subject.comments.length)
    return `comment count: expected ${reference.comments.length}, got ${subject.comments.length}`
  return null
}

/**
 * The text of a token, shortened.
 *
 * @param text - The file's text
 * @param token - Which span to show
 * @returns The span's text in quotes, at most 40 characters
 */
function show(text: string, token: ReferenceToken): string {
  const slice = text.slice(token.start, token.end)
  return `"${slice.length > 40 ? `${slice.slice(0, 37)}...` : slice}"`
}
