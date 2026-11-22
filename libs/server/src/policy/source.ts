/** How a host source reads against the grammar the policy fields accept. */
export type SourceVerdict = 'ok' | SourceProblem

/** The ways a host source can fall outside the grammar, each with a sentence of its own. */
export type SourceProblem = 'permits-every-origin' | 'scheme-missing' | 'has-path' | 'port-invalid' | 'wildcard-too-broad' | 'malformed'

// note: A scheme and its colon with nothing after them, which matches every origin of that scheme.
const SCHEME_ONLY = /^[a-z][a-z0-9+.-]*:$/

// note: An authority whose host is the bare wildcard, whatever port or path follows it.
const WILDCARD_HOST = /^\*(?:[:/]|$)/

const SCHEME = /^[a-z][a-z0-9+.-]*$/

const LABEL = /^[a-z0-9-]+$/

// note: A wildcard port, or a decimal without a leading zero short enough to compare as a number.
const PORT = /^(?:\*|[1-9][0-9]{0,4})$/

// note: The first character of a path, a query or a fragment.
const PATH_START = /[/?#]/

/** What to tell an author about each way a host source can be refused, as the rest of a sentence that opens with its path. */
export const SOURCE_PROBLEMS: Readonly<Record<SourceProblem, string>> = {
  'permits-every-origin': 'permits every origin: name each host instead of a bare "*", a scheme on its own or a "*" host.',
  'scheme-missing': 'must start with a scheme and "://", as in https://host.example.',
  'has-path': 'must end at the host or port: remove the path, query or fragment, a trailing "/" included.',
  'port-invalid': 'has a port that is neither "*" nor an integer between 1 and 65535.',
  'wildcard-too-broad': 'puts "*." over a single label: a wildcard needs at least two labels after it, as in https://*.host.example.',
  malformed: 'is not a source: expected scheme://host with an optional leading "*." label and an optional port.',
}

/**
 * Reports whether a source expression lets any origin through: a bare `*`, a
 * scheme on its own such as `https:`, or a host that is `*`. Letter case is
 * ignored, since a browser reads a source without regard to it.
 *
 * @param source - One source expression, as written in a policy.
 * @returns `true` when the expression names no particular host.
 *
 * @example Telling an open source from a wildcard over one site
 * ```typescript
 * permitsEveryOrigin('https://*') // => true
 * permitsEveryOrigin('https://*.host.example') // => false
 * ```
 */
export function permitsEveryOrigin(source: string): boolean {
  const lower = source.toLowerCase()
  const authorityAt = lower.indexOf('://')
  return SCHEME_ONLY.test(lower) || WILDCARD_HOST.test(authorityAt === -1 ? lower : lower.slice(authorityAt + 3))
}

/**
 * Reports whether the text after a host's colon is a port the grammar accepts.
 *
 * @param port - The text between the colon and the end of the source.
 * @returns `true` for `*` and for a decimal from 1 to 65535 without a leading zero.
 */
function isPort(port: string): boolean {
  return PORT.test(port) && (port === '*' || Number(port) <= 65535)
}

/**
 * Reads one source against the grammar `scheme://host[:port]`, where the host
 * may open with a `*.` label over at least two more, and names the first way it
 * falls outside. A scheme or host outside the grammar is reported ahead of a
 * port outside it, so an address the grammar has no form for is not blamed on
 * its port.
 *
 * @param source - One source expression.
 * @returns `'ok'`, or the way the expression was refused.
 *
 * @example Classifying two sources
 * ```typescript
 * classifyHostSource('https://*.host.example:8443') // => 'ok'
 * classifyHostSource('https://host.example/app') // => 'has-path'
 * ```
 */
export function classifyHostSource(source: string): SourceVerdict {
  if (permitsEveryOrigin(source)) {
    return 'permits-every-origin'
  }
  const authorityAt = source.indexOf('://')
  if (authorityAt === -1) {
    return 'scheme-missing'
  }
  const authority = source.slice(authorityAt + 3)
  if (!SCHEME.test(source.slice(0, authorityAt))) {
    return 'malformed'
  }
  if (PATH_START.test(authority)) {
    return 'has-path'
  }
  const portAt = authority.indexOf(':')
  const host = portAt === -1 ? authority : authority.slice(0, portAt)
  const labels = (host.startsWith('*.') ? host.slice(2) : host).split('.')
  if (!labels.every((label) => LABEL.test(label))) {
    return 'malformed'
  }
  if (portAt !== -1 && !isPort(authority.slice(portAt + 1))) {
    return 'port-invalid'
  }
  // why: A wildcard over one label covers a whole top-level domain, which is every site registered under it.
  return host.startsWith('*.') && labels.length < 2 ? 'wildcard-too-broad' : 'ok'
}
