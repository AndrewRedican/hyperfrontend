import type { PolicyIssue, PolicyIssueCode } from './issues'
import type { EmbedderSource, RuleScope, ServeHeaderRule } from './serve-types'
import { from, isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { policyIssue, refuse } from './issues'
import { scopedRule, scopeProblems } from './scope'
import { classifyHostSource, SOURCE_PROBLEMS } from './source'

/** One way an entry can be refused before it is read as a host source. */
interface EntryCheck {
  /** The kind of problem the check reports. */
  readonly code: PolicyIssueCode
  /** What is wrong, as the rest of a sentence that opens with the entry's path. */
  readonly text: string
  /** Tells whether the entry has the problem; `alone` says the entry is the only one of its list. */
  readonly fails: (entry: string, alone: boolean) => boolean
}

// note: The two keywords the directive takes, written the only way a browser reads them.
const KEYWORDS: readonly string[] = ["'self'", "'none'"]

// note: The keywords as an author tends to write them when the quotes are forgotten or doubled.
const MISQUOTED_KEYWORDS: readonly string[] = ['self', 'none', '"self"', '"none"']

// note: Checked in this order and stopped at the first that fails, so an entry is reported once and for its most basic fault.
const ENTRY_CHECKS: readonly EntryCheck[] = [
  { code: 'embedder-empty', text: 'must not be empty.', fails: (entry) => entry.length === 0 },
  {
    code: 'embedder-control-character',
    text: 'must not contain control characters.',
    fails: (entry) => entry.split('').some((character) => character < ' ' || character === '\u007f'),
  },
  {
    code: 'embedder-separator',
    text: 'must not contain ";" or ",": either would end the directive or start a second policy.',
    fails: (entry) => entry.includes(';') || entry.includes(','),
  },
  {
    code: 'embedder-whitespace',
    text: 'must be a single source: list each source as its own entry.',
    fails: (entry) => entry.includes(' '),
  },
  {
    code: 'embedder-not-ascii',
    text: 'must be ASCII: write an internationalised host in its punycode ("xn--") form.',
    fails: (entry) => entry.split('').some((character) => character > '~'),
  },
  { code: 'embedder-not-lowercase', text: 'must be lowercase.', fails: (entry) => /[A-Z]/.test(entry) },
  {
    code: 'embedder-none-not-alone',
    text: "is 'none', which must be the only entry.",
    fails: (entry, alone) => entry === "'none'" && !alone,
  },
  {
    code: 'embedder-keyword-unquoted',
    text: "is a keyword and must carry its single quotes: 'self' or 'none'.",
    fails: (entry) => MISQUOTED_KEYWORDS.includes(entry),
  },
  {
    code: 'embedder-keyword-unknown',
    text: "is not a frame-ancestors keyword: only 'self' and 'none' are.",
    fails: (entry) => !KEYWORDS.includes(entry) && (entry.includes("'") || entry.includes('"')),
  },
]

/**
 * Finds what is wrong with one entry of an embedders list.
 *
 * @param entry - The entry as authored.
 * @param path - Where the entry sits, used to open the message.
 * @param alone - Whether the entry is the only one of its list.
 * @returns The first problem the entry has, or `null` when it is a keyword or a host source.
 */
function checkEmbedder(entry: unknown, path: string, alone: boolean): PolicyIssue | null {
  if (typeof entry !== 'string') {
    return policyIssue('embedder-not-string', path, 'must be a string.')
  }
  const failed = ENTRY_CHECKS.find((check) => check.fails(entry, alone))
  if (failed !== undefined) {
    return policyIssue(failed.code, path, failed.text)
  }
  if (KEYWORDS.includes(entry)) {
    return null
  }
  const verdict = classifyHostSource(entry)
  return verdict === 'ok' ? null : policyIssue(`embedder-${verdict}`, path, SOURCE_PROBLEMS[verdict])
}

/**
 * Checks a value as the `embedders` field of a serve config: the origins
 * allowed to frame what the server sends.
 *
 * An entry is `'self'`, `'none'` as the only entry, or `scheme://host` with an
 * optional leading `*.` label and an optional port, in lowercase ASCII with no
 * path. Each entry is reported at most once, and no message repeats the entry
 * it is about. A hole in the list is an entry that is no string.
 *
 * @param value - The candidate list.
 * @returns Every problem found, in list order; empty when the list is sound.
 *
 * @example Checking a list before it is published
 * ```typescript
 * checkEmbedders(["'self'", 'https://host.example']) // => []
 * checkEmbedders(['host.example']).map((issue) => issue.code) // => ['embedder-scheme-missing']
 * ```
 */
export function checkEmbedders(value: unknown): readonly PolicyIssue[] {
  if (!isArray(value)) {
    return [{ code: 'embedders-not-array', path: 'embedders', message: '"embedders" must be an array of sources.' }]
  }
  // why: A hole is walked like any entry, so a list a doubled comma left sparse is refused instead of being written with an empty slot.
  return from(value, (entry: unknown, index) => checkEmbedder(entry, `embedders[${index}]`, value.length === 1)).filter(
    (issue): issue is PolicyIssue => issue !== null
  )
}

/**
 * Writes a `frame-ancestors` directive from a list of embedders, in the order
 * the list gives them. An empty list writes `'none'`.
 *
 * @param sources - The origins allowed to frame the response.
 * @returns The directive, with no trailing semicolon.
 * @throws {Error} When an entry is refused, with one line per problem.
 *
 * @example Writing the directive for a page two sites may frame
 * ```typescript
 * frameAncestors(["'self'", 'https://host.example']) // => "frame-ancestors 'self' https://host.example"
 * frameAncestors([]) // => "frame-ancestors 'none'"
 * ```
 */
export function frameAncestors(sources: readonly EmbedderSource[]): string {
  refuse(checkEmbedders(sources).map((issue) => issue.message))
  return sources.length === 0 ? "frame-ancestors 'none'" : `frame-ancestors ${sources.join(' ')}`
}

/**
 * Chooses the `X-Frame-Options` header that says the same as a list of
 * embedders, for the browsers that read no `frame-ancestors`. Only the two
 * lists the older header can express get one.
 *
 * @param sources - A list {@link checkEmbedders} accepts.
 * @returns `DENY` for no embedder, `SAMEORIGIN` for `'self'` alone, and no header otherwise.
 *
 * @example Pairing the older header with a list
 * ```typescript
 * frameOptions(["'self'"]) // => { 'X-Frame-Options': 'SAMEORIGIN' }
 * frameOptions(['https://host.example']) // => {}
 * ```
 */
export function frameOptions(sources: readonly EmbedderSource[]): Record<string, string> {
  if (sources.length === 0 || sources[0] === "'none'") {
    return { 'X-Frame-Options': 'DENY' }
  }
  return sources.length === 1 && sources[0] === "'self'" ? { 'X-Frame-Options': 'SAMEORIGIN' } : {}
}

/**
 * Builds the header rule that restricts who may frame a response: a
 * `Content-Security-Policy` holding one `frame-ancestors` directive, followed
 * by `X-Frame-Options` when the list is empty, `'none'` or `'self'` alone.
 *
 * The policy holds nothing else, so a later rule that sets the header replaces
 * it whole; use `contentSecurityPolicy` when the response needs other
 * directives too.
 *
 * @param sources - The origins allowed to frame the response.
 * @param scope - The paths the rule applies to; every path when omitted.
 * @returns The rule.
 * @throws {Error} When an entry or the scope is refused, with one line per problem.
 *
 * @example Letting one host frame every page
 * ```typescript
 * embedders(["'self'", 'https://host.example'])
 * // => { headers: { 'Content-Security-Policy': "frame-ancestors 'self' https://host.example" } }
 * ```
 */
export function embedders(sources: readonly EmbedderSource[], scope?: RuleScope): ServeHeaderRule {
  refuse([...checkEmbedders(sources).map((issue) => issue.message), ...scopeProblems(scope)])
  return scopedRule({ 'Content-Security-Policy': frameAncestors(sources), ...frameOptions(sources) }, scope)
}
