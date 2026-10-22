/**
 * The Key Features list of a library README, read the way the documentation site reads it: a
 * flat run of `- **Label** explanation` bullets, the label a short name and the explanation the
 * reason the feature matters. HTML comments may sit in the list; anything else is out of place,
 * and a fenced block is flagged once at its opening fence.
 *
 * @module rules/workspace/shared/key-features
 */

import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Something wrong with the list, on the line it sits on. */
export interface KeyFeatureFinding {
  /** The 1-based line. */
  readonly line: number
  /** What is wrong and how to fix it. */
  readonly message: string
}

/** The longest a label may render. */
const LABEL_LIMIT = 48

/** The shortest an explanation may be. */
const EXPLANATION_FLOOR = 20

/** How many features a list holds at least and at most. */
const FEWEST = 3
const MOST = 12

/** What opens a fenced block. */
const FENCE = /^(?:```|~~~)/

/**
 * Shortens a line for quoting in a message.
 *
 * @param text - The text to quote
 * @returns The text, cut at sixty characters with an ellipsis when longer
 */
function quote(text: string): string {
  return text.length > 60 ? `${text.slice(0, 60).trimEnd()}...` : text
}

/**
 * Checks one top-level bullet.
 *
 * @param body - The bullet's text after its marker, leading spaces removed
 * @returns The messages the bullet draws, empty when it is well formed
 */
function bulletMessages(body: string): string[] {
  const close = body.startsWith('**') ? body.indexOf('**', 2) : -1
  const label = close === -1 ? '' : body.slice(2, close).trim()
  if (label === '') {
    return [
      `Key feature '${quote(body)}' does not open with a bold label. Write it as '- **Label** - explanation' so the label can be read on its own.`,
    ]
  }
  const messages: string[] = []
  // why: the site renders a linked label as its link text and a coded one without the backticks, so that is the length a reader sees.
  const rendered = label.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`/g, '')
  if (rendered.length > LABEL_LIMIT) {
    messages.push(
      `Key feature label '${rendered}' is ${rendered.length} characters, past the ${LABEL_LIMIT} a label may use. Cut it back to a name and move the rest into the explanation after it.`
    )
  }
  const explanation = body
    .slice(close + 2)
    .replace(/^\s*[-:]?\s*/, '')
    .trimEnd()
  if (explanation === '') {
    messages.push(
      `Key feature '${label}' is a bare label. Follow it with an explanation, separated by ': ' or ' - ', saying what the feature gives the reader.`
    )
  } else if (explanation.length < EXPLANATION_FLOOR) {
    messages.push(
      `Key feature '${label}' explains itself in ${explanation.length} characters, under the ${EXPLANATION_FLOOR} required. Say what it does for the reader instead of restating the label.`
    )
  }
  return messages
}

/**
 * Reads the Key Features section and says what is wrong with its list.
 *
 * @param lines - The README's lines
 * @param heading - The 1-based line of the `### Key Features` heading
 * @param last - The 1-based last line of the section
 * @returns The findings, in line order, the list's length last
 */
export function keyFeatureFindings(lines: readonly string[], heading: number, last: number): KeyFeatureFinding[] {
  const findings: KeyFeatureFinding[] = []
  let features = 0
  let inside: 'comment' | 'fence' | null = null
  for (let line = heading + 1; line <= min(last, lines.length); line += 1) {
    const raw = lines[line - 1] as string
    const text = raw.trim()
    if (inside === 'comment') {
      if (text.includes('-->')) inside = null
      continue
    }
    if (inside === 'fence') {
      if (FENCE.test(text)) inside = null
      continue
    }
    if (text === '') continue
    if (text.startsWith('<!--')) {
      if (!text.includes('-->')) inside = 'comment'
      continue
    }
    if (FENCE.test(text)) inside = 'fence'
    if (raw.startsWith('- ') || raw.startsWith('* ')) {
      features += 1
      for (const message of bulletMessages(raw.slice(2).trimStart())) findings.push({ line, message })
      continue
    }
    findings.push({
      line,
      message: `Key Features must be a flat bullet list, and '${quote(text)}' is not a top-level bullet. Rewrite it as a '- **Label** - explanation' bullet, or move it under a heading of its own.`,
    })
  }
  if (features > 0 && features < FEWEST) {
    findings.push({
      line: heading,
      message: `Key Features lists ${features} features, under the ${FEWEST} a package needs to summarise itself. Add the features a reader would choose this package for.`,
    })
  } else if (features > MOST) {
    findings.push({
      line: heading,
      message: `Key Features lists ${features} features, past the ${MOST} a reader takes in at a glance. Keep the ones that decide adoption and let the sections below carry the rest.`,
    })
  }
  return findings
}
