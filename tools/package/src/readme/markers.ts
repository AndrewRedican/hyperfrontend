import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * How a replacement region begins: an HTML comment carrying the directive's
 * attributes. It hides on GitHub, on npm and on the documentation site, so a
 * reader of the source markdown sees the region's own content and nothing
 * else.
 */
const START_PATTERN = /^<!--\s*hf:media\s+start\s+(.*?)\s*-->\s*$/

/** How a replacement region ends. */
const END_PATTERN = /^<!--\s*hf:media\s+end\s*-->\s*$/

/** Anything that looks like it wanted to be a directive, so a typo fails rather than hides. */
const LOOKALIKE_PATTERN = /^<!--\s*hf:media\b/

/** One `name="value"` pair, with a value that may not contain a double quote. */
const ATTRIBUTE_PATTERN = /([a-z]+)="([^"]*)"/g

/** The characters an identifier, a scene slug or an asset stem is made of. */
const NAME_CHARACTERS = /^[a-z0-9-]+$/

/**
 * Whether a name is lower-case runs joined by single hyphens.
 *
 * Checked in two steps rather than one pattern, because a pattern with a
 * quantified group inside a quantifier is what the workspace's backtracking
 * check refuses, and it refuses it structurally rather than by proving a
 * given case safe.
 *
 * @param text - The name as written.
 * @returns True when every run is non-empty and no hyphen leads, trails or doubles.
 */
function isWellFormedName(text: string): boolean {
  return NAME_CHARACTERS.test(text) && text.split('-').every((run) => run !== '')
}

/** Attributes a directive is allowed to carry. */
const KNOWN_ATTRIBUTES = createSet(['id', 'scene', 'asset', 'docs', 'alt'])

/** Attributes a directive must carry. */
const REQUIRED_ATTRIBUTES: readonly string[] = ['id', 'scene', 'alt']

/**
 * One replacement region, as declared in the source markdown.
 *
 * The region is the lines between its two markers. Everything the transform
 * needs to replace them is on the start marker, so the region's own content
 * can be any markdown at all: a table, a code block, a list, a paragraph, or
 * nothing, for a visual that is inserted rather than substituted.
 */
export interface MediaDirective {
  /** Stable identifier, unique within the file. */
  id: string
  /** The scene whose asset replaces the region. */
  scene: string
  /**
   * The asset's filename stem within the scene, `hero` when omitted. A stem
   * never carries a theme suffix: the distribution readme is read on pages
   * whose theme nobody here controls, so it embeds the portable file, and
   * that is the bare stem.
   */
  asset: string
  /** Where the visual links to: a path under the package's documentation, an absolute URL, or undefined for the package's landing page. */
  docs: string | undefined
  /** The visual's alternative text. */
  alt: string
  /** Index of the line the start marker is on. */
  startLine: number
  /** Index of the line the end marker is on. */
  endLine: number
}

/** A directive that could not be read, and where. */
export interface MarkerProblem {
  /** Index of the offending line. */
  line: number
  /** What is wrong, phrased as the fix. */
  reason: string
}

/** Every region a document declares, or every reason it could not be read. */
export interface ParsedMarkers {
  /** The regions, in document order. */
  directives: readonly MediaDirective[]
  /** Everything that stopped a directive from being read; empty when all were. */
  problems: readonly MarkerProblem[]
}

/**
 * Read the attributes off a start marker.
 *
 * @param body - The text between `start` and the closing `-->`.
 * @param line - The line the marker is on, for the report.
 * @param problems - Where to record what is wrong.
 * @returns The attributes by name, or undefined when any could not be read.
 */
function readAttributes(body: string, line: number, problems: MarkerProblem[]): ReadonlyMap<string, string> | undefined {
  const attributes = createMap<string, string>()
  let consumed = ''
  for (const match of body.matchAll(ATTRIBUTE_PATTERN)) {
    const [whole, name = '', value = ''] = match
    consumed += `${whole} `
    if (!KNOWN_ATTRIBUTES.has(name)) {
      problems.push({ line, reason: `unknown attribute "${name}"; a directive takes ${[...KNOWN_ATTRIBUTES].join(', ')}` })
      return undefined
    }
    if (attributes.has(name)) {
      problems.push({ line, reason: `attribute "${name}" is given twice` })
      return undefined
    }
    attributes.set(name, value)
  }
  if (consumed.replace(/\s+/g, '') !== body.replace(/\s+/g, '')) {
    problems.push({ line, reason: 'attributes must be written as name="value", separated by spaces' })
    return undefined
  }
  for (const required of REQUIRED_ATTRIBUTES) {
    if ((attributes.get(required) ?? '') === '') {
      problems.push({ line, reason: `a directive needs ${required}="..."` })
      return undefined
    }
  }
  return attributes
}

/**
 * Turn a start marker's attributes into a directive.
 *
 * @param attributes - The attributes as written.
 * @param startLine - The line the start marker is on.
 * @param problems - Where to record what is wrong.
 * @returns The directive with its end line still to be found, or undefined when a value is malformed.
 */
function toDirective(attributes: ReadonlyMap<string, string>, startLine: number, problems: MarkerProblem[]): MediaDirective | undefined {
  // why: the required attributes were checked present before this is reached, so the fallbacks here are for the type and never taken
  /* node:coverage ignore next 2 */
  const id = attributes.get('id') ?? ''
  const scene = attributes.get('scene') ?? ''
  const asset = attributes.get('asset') ?? 'hero'
  if (!isWellFormedName(id)) {
    problems.push({ line: startLine, reason: `id "${id}" must be lower-case words joined by single hyphens` })
    return undefined
  }
  if (!isWellFormedName(scene)) {
    problems.push({ line: startLine, reason: `scene "${scene}" must be a scene slug: lower-case words joined by single hyphens` })
    return undefined
  }
  if (!isWellFormedName(asset)) {
    problems.push({
      line: startLine,
      reason: `asset "${asset}" must be a filename stem: lower-case words joined by single hyphens, with no extension and no theme suffix`,
    })
    return undefined
  }
  const docs = attributes.get('docs')
  return {
    id,
    scene,
    asset,
    docs: docs === undefined || docs === '' ? undefined : docs,
    /* node:coverage ignore next 1 */
    alt: attributes.get('alt') ?? '',
    startLine,
    endLine: -1,
  }
}

/**
 * Find every replacement region a markdown document declares.
 *
 * Regions are read structurally: a start marker opens one, the next end
 * marker closes it, and nothing may open inside an open region. Each marker
 * is one line, so a comment that opens like a directive and does not close on
 * the same line is reported rather than swallowing the rest of the document.
 * Fenced code blocks are skipped, so a directive quoted as an example in a
 * code sample is sample text rather than a region. Anything that begins like
 * a directive but does not parse is reported rather than ignored, because a
 * marker that is quietly treated as an ordinary comment would leave its
 * region untransformed and nobody told.
 *
 * @param markdown - The source document.
 * @returns The regions in order, and every problem found.
 * @example One region around a table
 * ```ts
 * parseMarkers([
 *   '<!-- hf:media start id="layout" scene="builder-manifest" alt="The manifest the build writes" -->',
 *   '| Field | Written from |',
 *   '| --- | --- |',
 *   '<!-- hf:media end -->',
 * ].join('\n')).directives[0]?.id // 'layout'
 * ```
 */
export function parseMarkers(markdown: string): ParsedMarkers {
  const lines = markdown.split('\n')
  const directives: MediaDirective[] = []
  const problems: MarkerProblem[] = []
  const seen = createSet<string>()
  let open: MediaDirective | undefined
  // why: a start marker that could not be read still owns the lines up to its end marker, so that end marker is not reported as a second, unrelated problem
  let skipping = false
  let inFence = false

  lines.forEach((line, index) => {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      return
    }
    if (inFence) {
      return
    }
    const start = START_PATTERN.exec(line)
    if (start !== null) {
      if (open !== undefined) {
        problems.push({
          line: index,
          reason: `region "${open.id}" opened on line ${open.startLine + 1} is still open; close it before starting another`,
        })
        open = undefined
      }
      // why: the pattern's one group always captures once the pattern has matched, so the fallback is for the type and never taken
      /* node:coverage ignore next 1 */
      const attributes = readAttributes(start[1] ?? '', index, problems)
      const directive = attributes === undefined ? undefined : toDirective(attributes, index, problems)
      if (directive === undefined) {
        skipping = true
        return
      }
      if (seen.has(directive.id)) {
        problems.push({ line: index, reason: `id "${directive.id}" is used twice; every region needs its own` })
        skipping = true
        return
      }
      seen.add(directive.id)
      open = directive
      return
    }
    if (END_PATTERN.test(line)) {
      if (skipping) {
        skipping = false
        return
      }
      if (open === undefined) {
        problems.push({ line: index, reason: 'an end marker with no region open before it' })
        return
      }
      directives.push({ ...open, endLine: index })
      open = undefined
      return
    }
    if (LOOKALIKE_PATTERN.test(line)) {
      problems.push({
        line: index,
        reason: 'this looks like a directive but is neither `<!-- hf:media start ... -->` nor `<!-- hf:media end -->` on one line',
      })
    }
  })

  if (open !== undefined) {
    problems.push({ line: open.startLine, reason: `region "${open.id}" is never closed; add <!-- hf:media end --> after its content` })
  }
  return { directives, problems }
}
