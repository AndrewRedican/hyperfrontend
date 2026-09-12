/**
 * Characters a feature label may use before it stops reading as a name.
 *
 * The documentation site renders the label on its own, ahead of the explanation, so a label
 * has to survive being read alone. Across the library READMEs the longest label in use is
 * well inside this, which leaves room for a backticked symbol without leaving room for a
 * sentence wearing bold.
 */
export const MAX_FEATURE_LABEL_CHARACTERS = 48

/**
 * Characters a feature explanation must reach before it says anything the label did not.
 *
 * Anything shorter is a restatement of the label, which reads as a filled-in template rather
 * than a reason to adopt the package.
 */
export const MIN_FEATURE_DESCRIPTION_CHARACTERS = 20

/**
 * Features a package must list before the section is worth rendering.
 */
export const MIN_KEY_FEATURES = 3

/**
 * Features a package may list before the section stops being a summary.
 */
export const MAX_KEY_FEATURES = 12

/**
 * Markers a top-level bullet may start with, at column zero.
 */
const BULLET_MARKERS = ['- ', '* '] as const

/**
 * Fence markers that open a code block.
 */
const FENCE_MARKERS = ['```', '~~~'] as const

/**
 * Opening delimiter of an HTML comment.
 */
const HTML_COMMENT_OPEN = '<!--'

/**
 * Closing delimiter of an HTML comment.
 */
const HTML_COMMENT_CLOSE = '-->'

/**
 * Characters a quoted fragment may use inside a message before it is cut short.
 */
const MESSAGE_FRAGMENT_CHARACTERS = 60

/**
 * Message identifiers the Key Features analysis reports, each declared by the
 * `lib-readme-structure` rule.
 */
export type KeyFeaturesMessageId =
  | 'keyFeaturesNotAList'
  | 'keyFeatureMissingLabel'
  | 'keyFeatureMissingDescription'
  | 'keyFeatureLabelTooLong'
  | 'keyFeatureDescriptionTooShort'
  | 'keyFeaturesTooFew'
  | 'keyFeaturesTooMany'

/**
 * A single problem found in a Key Features section.
 */
export interface KeyFeaturesProblem {
  /** The message the rule reports for this problem. */
  messageId: KeyFeaturesMessageId
  /** Line the problem sits on, 1-based, ready to hand to a report's `loc`. */
  line: number
  /** Placeholder values the message interpolates. */
  data: Record<string, string>
}

/**
 * The line span a parsed section occupies, as `parseMarkdownSections` records it.
 */
export interface KeyFeaturesRange {
  /** Line the section heading sits on, 1-based. */
  startLine: number
  /** Last line the section covers, 1-based. */
  endLine: number
}

/**
 * A bullet split into the label a reader scans and the explanation underneath it.
 */
export interface FeatureBullet {
  /** The bold label, or null when the bullet does not open with one. */
  label: string | null
  /** Everything after the label, with a leading `: ` or ` - ` separator removed. */
  description: string
}

/**
 * Cuts a fragment down to a length a message can carry.
 *
 * @param text - The fragment to quote.
 * @returns The fragment, shortened with a trailing ellipsis when it runs long.
 */
function shorten(text: string): string {
  if (text.length <= MESSAGE_FRAGMENT_CHARACTERS) {
    return text
  }

  return `${text.slice(0, MESSAGE_FRAGMENT_CHARACTERS).trimEnd()}...`
}

/**
 * Removes the separator that stands between a label and its explanation.
 *
 * A bullet may also continue its label as a clause, as in `- **Value picker** for cyclical
 * iteration`, which reads better than a punctuation mark forced between the two. Both shapes
 * leave the same explanation behind.
 *
 * @param remainder - Everything after the closing `**`.
 * @returns The explanation, without a leading separator.
 */
function stripSeparator(remainder: string): string {
  const trimmed = remainder.trim()

  if (trimmed.startsWith(':') || trimmed.startsWith('-')) {
    return trimmed.slice(1).trim()
  }

  return trimmed
}

/**
 * Reduces a label to the text a reader sees.
 *
 * A label may be a link, so the feature's name is also the way to its page, and the URL
 * inside the link is markup rather than something the reader reads. The length limit is
 * about what is rendered, so it is measured on the visible text alone.
 *
 * @param label - The label as the markdown wrote it.
 * @returns The label with link and code markup removed.
 */
export function visibleLabel(label: string): string {
  return label.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`/g, '')
}

/**
 * Checks whether a line is a top-level bullet.
 *
 * The marker has to sit at column zero: an indented bullet is a nested list, which the
 * section does not allow.
 *
 * @param line - The raw line, indentation included.
 * @returns True when the line opens a top-level list item.
 */
export function isFeatureBullet(line: string): boolean {
  return BULLET_MARKERS.some((marker) => line.startsWith(marker))
}

/**
 * Splits a bullet into its bold label and the explanation after it.
 *
 * @param line - The bullet line, marker included.
 * @returns The label and explanation, with a null label when the bullet has none.
 */
export function parseFeatureBullet(line: string): FeatureBullet {
  const body = line.slice(2).trim()

  if (!body.startsWith('**')) {
    return { label: null, description: '' }
  }

  const closing = body.indexOf('**', 2)

  if (closing === -1) {
    return { label: null, description: '' }
  }

  const label = body.slice(2, closing).trim()

  if (!label) {
    return { label: null, description: '' }
  }

  return { label, description: stripSeparator(body.slice(closing + 2)) }
}

/**
 * Finds the line after the one that closes a block.
 *
 * @param lines - Every line of the file.
 * @param startIndex - The 0-based index to start scanning at.
 * @param limit - The 0-based index to stop scanning at.
 * @param isClosing - Predicate identifying the closing line.
 * @returns The index after the closing line, or the limit when nothing closes the block.
 */
function skipPast(lines: readonly string[], startIndex: number, limit: number, isClosing: (line: string) => boolean): number {
  for (let index = startIndex; index < limit; index++) {
    if (isClosing(lines[index] ?? '')) {
      return index + 1
    }
  }

  return limit
}

/**
 * Checks whether a line opens a fenced block.
 *
 * @param trimmed - The line with its surrounding whitespace removed.
 * @returns True when the line opens a code fence.
 */
function isFenceStart(trimmed: string): boolean {
  return FENCE_MARKERS.some((marker) => trimmed.startsWith(marker))
}

/**
 * Checks one bullet against the shape the documentation site renders.
 *
 * @param line - The bullet line, marker included.
 * @param lineNumber - The line the bullet sits on, 1-based.
 * @returns Every problem the bullet carries.
 */
function checkBullet(line: string, lineNumber: number): KeyFeaturesProblem[] {
  const problems: KeyFeaturesProblem[] = []
  const { label, description } = parseFeatureBullet(line)

  if (label === null) {
    problems.push({ messageId: 'keyFeatureMissingLabel', line: lineNumber, data: { feature: shorten(line.slice(2).trim()) } })
    return problems
  }

  const visible = visibleLabel(label)

  if (visible.length > MAX_FEATURE_LABEL_CHARACTERS) {
    problems.push({
      messageId: 'keyFeatureLabelTooLong',
      line: lineNumber,
      data: { feature: shorten(visible), characters: `${visible.length}`, maximum: `${MAX_FEATURE_LABEL_CHARACTERS}` },
    })
  }

  if (!description) {
    problems.push({ messageId: 'keyFeatureMissingDescription', line: lineNumber, data: { feature: shorten(label) } })
    return problems
  }

  if (description.length < MIN_FEATURE_DESCRIPTION_CHARACTERS) {
    problems.push({
      messageId: 'keyFeatureDescriptionTooShort',
      line: lineNumber,
      data: { feature: shorten(label), characters: `${description.length}`, minimum: `${MIN_FEATURE_DESCRIPTION_CHARACTERS}` },
    })
  }

  return problems
}

/**
 * Checks a Key Features section against the convention the documentation site renders.
 *
 * The section is read as a flat list of labelled features: the site pulls each label out as
 * the feature's name and the text after it as the reason it matters, so a lead-in paragraph,
 * a nested bullet, a table or a fenced block has nowhere to go. An HTML comment is left
 * alone, since a README parks an asset note inside the list it belongs to.
 *
 * A section with no bullets at all returns only its structural problems: the rule's own
 * `missingKeyFeaturesList` already names that case, and counting an absent list as too few
 * features would say it twice.
 *
 * @param lines - Every line of the README.
 * @param section - The line span the Key Features section covers.
 * @returns Every problem found, in the order the lines carry them.
 */
export function analyzeKeyFeatures(lines: readonly string[], section: KeyFeaturesRange): KeyFeaturesProblem[] {
  const problems: KeyFeaturesProblem[] = []
  let features = 0
  let index = section.startLine

  while (index < section.endLine) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()

    if (!trimmed) {
      index++
      continue
    }

    if (trimmed.startsWith(HTML_COMMENT_OPEN)) {
      index = skipPast(lines, index, section.endLine, (candidate) => candidate.includes(HTML_COMMENT_CLOSE))
      continue
    }

    if (!isFeatureBullet(line)) {
      problems.push({ messageId: 'keyFeaturesNotAList', line: index + 1, data: { line: shorten(trimmed) } })
      // why: a fenced block reports once as one intrusion, rather than once for every line inside it
      index = isFenceStart(trimmed) ? skipPast(lines, index + 1, section.endLine, (candidate) => isFenceStart(candidate.trim())) : index + 1
      continue
    }

    features++
    problems.push(...checkBullet(line, index + 1))
    index++
  }

  if (features === 0) {
    return problems
  }

  if (features < MIN_KEY_FEATURES) {
    problems.push({
      messageId: 'keyFeaturesTooFew',
      line: section.startLine,
      data: { count: `${features}`, minimum: `${MIN_KEY_FEATURES}` },
    })
  } else if (features > MAX_KEY_FEATURES) {
    problems.push({
      messageId: 'keyFeaturesTooMany',
      line: section.startLine,
      data: { count: `${features}`, maximum: `${MAX_KEY_FEATURES}` },
    })
  }

  return problems
}
