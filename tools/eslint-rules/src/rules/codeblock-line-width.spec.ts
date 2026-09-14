import type { CodeblockLineWidthOptions, MarkdownCodeNode } from './codeblock-line-width'
import markdown from '@eslint/markdown'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import rule, {
  DEFAULT_MAX_LINE_LENGTH,
  DEFAULT_MIN_LINE_LENGTH,
  findWideLines,
  hasFoldableSpan,
  isDeclaration,
  isExemptLine,
  isFoldableCommand,
  isMethodSignature,
  measureLine,
  RULE_NAME,
} from './codeblock-line-width'

/**
 * One traversal step handed out by the markdown source code object.
 */
interface TraversalStep {
  /** The node being entered or left. */
  target: MarkdownCodeNode
  /** 1 on the way in, 2 on the way out. */
  phase: number
}

/**
 * The parts of the parsed markdown document the tests drive.
 */
interface ParsedMarkdown {
  /** Walks the document, entering and leaving every node. */
  traverse: () => Iterable<TraversalStep>
}

/**
 * The parts of the markdown language object the tests drive.
 */
interface MarkdownLanguageShim {
  /** Language options the parser falls back to. */
  defaultLanguageOptions: unknown
  /** Parses a virtual file into an mdast document. */
  parse: (file: unknown, context: unknown) => unknown
  /** Wraps a parse result in a source code object. */
  createSourceCode: (file: unknown, parseResult: unknown) => ParsedMarkdown
}

/**
 * The shape of the report descriptors this rule produces.
 */
interface CapturedReport {
  /** The message identifier. */
  messageId: string
  /** The reported source range, absent when the node carried no position. */
  loc?: { start: { line: number; column: number }; end: { line: number; column: number } }
  /** The message interpolations. */
  data?: { width: string }
}

type ListenerMap = Record<string, ((node: MarkdownCodeNode) => void) | undefined>

const language = markdown.languages.gfm as unknown as MarkdownLanguageShim

/**
 * Runs the rule over real markdown, driving the listeners it registers from the real mdast
 * traversal, so the AST path is the one under test.
 *
 * @param text - The markdown source.
 * @param options - Rule options, if any.
 * @param filename - The file the markdown is linted as.
 * @returns Every problem the rule reported, in document order.
 */
function lintMarkdown(text: string, options?: CodeblockLineWidthOptions, filename = 'README.md'): CapturedReport[] {
  const file = { path: filename, physicalPath: filename, body: text, bom: false }
  const parsed = language.createSourceCode(file, language.parse(file, { languageOptions: language.defaultLanguageOptions }))
  const reports: CapturedReport[] = []

  const context = {
    filename,
    options: options ? [options] : [],
    sourceCode: parsed,
    report: (descriptor: CapturedReport) => reports.push(descriptor),
  }

  // @ts-expect-error - partial mock
  const listeners = rule.create(context) as unknown as ListenerMap

  for (const step of parsed.traverse()) {
    if (step.phase === 1) listeners[step.target.type]?.(step.target)
  }

  return reports
}

/**
 * Wraps code in a fence.
 *
 * @param lang - The fence language.
 * @param code - The block's lines.
 * @returns A markdown document holding one block.
 */
function fenced(lang: string, ...code: string[]): string {
  return `# Title\n\n\`\`\`${lang}\n${code.join('\n')}\n\`\`\`\n`
}

const WIDE_OBJECT = "const channel = createChannel('link', { send, receive, protocolProvider, session: nextSession, onDrop })"
const WIDE_COMMAND = 'npm uninstall commitizen cz-conventional-changelog @commitlint/cli @commitlint/config-conventional'
const WIDE_SIGNATURE = 'function createUnencryptedPacket<T = any>(origin: string, target: string, data: Data<T>): UnencryptedPacket<T>'
const WIDE_URL = 'git clone https://github.com/YOUR_USERNAME/hyperfrontend.git --depth 1 --branch main --single-branch'

describe('codeblock-line-width', () => {
  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('codeblock-line-width')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('suggestion')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('codeblock-line-width')
    })

    it('declares one message per foldable shape', () => {
      expect(keys(rule.meta?.messages ?? {})).toEqual(['entries', 'command'])
    })

    it('names the width in both messages', () => {
      expect(rule.meta?.messages).toEqual({ entries: expect.stringContaining('{{width}}'), command: expect.stringContaining('{{width}}') })
    })

    it('accepts both thresholds as options', () => {
      const schema = rule.meta?.schema as Array<Record<string, unknown>>
      const properties = schema[0]?.['properties'] as Record<string, unknown>
      expect(keys(properties)).toEqual(['minLineLength', 'maxLineLength'])
    })

    it('defaults the floor to 80 and the ceiling to 140', () => {
      expect([DEFAULT_MIN_LINE_LENGTH, DEFAULT_MAX_LINE_LENGTH]).toEqual([80, 140])
    })
  })

  describe('measureLine', () => {
    it('counts characters', () => {
      expect(measureLine('const x = 1')).toBe(11)
    })

    it('counts a tab as four columns', () => {
      expect(measureLine('\tx')).toBe(5)
    })
  })

  describe('isExemptLine', () => {
    it('exempts a line carrying a url', () => {
      expect(isExemptLine(WIDE_URL)).toBe(true)
    })

    it('exempts a line carrying a long token', () => {
      expect(isExemptLine("const digest = sha256('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', a, b)")).toBe(true)
    })

    it('exempts a comment', () => {
      expect(isExemptLine('// { inProgress: true, success: false, fail: false, halt: false, retries: 3 }')).toBe(true)
    })

    it('exempts a hash comment', () => {
      expect(isExemptLine('# a comment with a list (one, two, three, four, five, six, seven, eight)')).toBe(true)
    })

    it('exempts an import', () => {
      expect(
        isExemptLine("import { createShell, DisplayMode, type ShellOptions, type ShellHandle } from '@hyperfrontend/features/host'")
      ).toBe(true)
    })

    it('exempts a function declaration', () => {
      expect(isExemptLine(WIDE_SIGNATURE)).toBe(true)
    })

    it('exempts an exported type alias', () => {
      expect(isExemptLine('export type QueueFailureHandler = (raw: unknown, reason: string, cause?: unknown) => void')).toBe(true)
    })

    it('exempts a function-typed member', () => {
      expect(
        isExemptLine('seal: (key: CryptoKey, nonce: Uint8Array, additionalData: Uint8Array, plaintext: Uint8Array) => Promise<Uint8Array>')
      ).toBe(true)
    })

    it('exempts a method signature', () => {
      expect(isExemptLine('request(type: string, data?: unknown, options?: RequestOptions): Promise<unknown>')).toBe(true)
    })

    it('keeps a method whose body opens on the line', () => {
      expect(isExemptLine('request(type: string, data?: unknown, options?: RequestOptions): Promise<unknown> {')).toBe(false)
    })

    it('keeps an ordinary call', () => {
      expect(isExemptLine(WIDE_OBJECT)).toBe(false)
    })
  })

  describe('isDeclaration', () => {
    it('recognises an async function after a declare modifier', () => {
      expect(isDeclaration('declare async function load(a: string, b: string, c: string): Promise<void>')).toBe(true)
    })

    it('recognises an anonymous function with no space before its parameters', () => {
      expect(isDeclaration('function(first: string, second: string, third: string) {')).toBe(true)
    })

    it('does not mistake an identifier that starts with a keyword', () => {
      expect(isDeclaration('functionRegistry.register(first, second, third, fourth, fifth)')).toBe(false)
    })

    it('treats an empty line as no declaration', () => {
      expect(isDeclaration('')).toBe(false)
    })
  })

  describe('isMethodSignature', () => {
    it('recognises a generic method signature', () => {
      expect(isMethodSignature('create<T>(name: string, options: CreateOptions, extra: Extra): Result<T>')).toBe(true)
    })

    it('rejects a generic that never closes', () => {
      expect(isMethodSignature('create<T(name: string, options: CreateOptions, extra: Extra): Result')).toBe(false)
    })

    it('rejects a line that does not open with an identifier', () => {
      expect(isMethodSignature('(name: string, options: CreateOptions, extra: Extra): Result')).toBe(false)
    })

    it('rejects a name followed by something other than a parameter list', () => {
      expect(isMethodSignature('create = build(name, options, extra, more, evenMore, andMore)')).toBe(false)
    })

    it('rejects a parameter list that never closes', () => {
      expect(isMethodSignature('create(name: string, options: CreateOptions, extra: Extra')).toBe(false)
    })

    it('rejects a call with no return type', () => {
      expect(isMethodSignature('create(name, options, extra, more, evenMore, andMore, yetMore)')).toBe(false)
    })
  })

  describe('hasFoldableSpan', () => {
    it('finds an object literal with three or more members', () => {
      expect(hasFoldableSpan(WIDE_OBJECT)).toBe(true)
    })

    it('finds a call with three or more arguments', () => {
      expect(hasFoldableSpan('const logger = createLogger(console.error, console.warn, console.log, console.info, console.debug)')).toBe(
        true
      )
    })

    it('ignores a span with two entries', () => {
      expect(hasFoldableSpan("const data = deserializeData(await createData(sessionPid, someVeryLongIdentifierName), 'x')")).toBe(false)
    })

    it('does not count commas inside strings', () => {
      expect(hasFoldableSpan("log('one, two, three, four, five, six, seven, eight, nine, ten, eleven', level)")).toBe(false)
    })

    it('does not count commas inside a nested span toward the outer one', () => {
      expect(hasFoldableSpan('const out = outer(first, inner(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p))')).toBe(true)
    })

    it('ignores a short span however many entries it has', () => {
      expect(hasFoldableSpan('f(a, b, c, d) // and a comment that makes the line long enough to be looked at')).toBe(false)
    })

    it('ignores a span that never closes on the line', () => {
      expect(hasFoldableSpan("createShell({ url, container, protocol: 'v4', sharedKey, onOpen, onClose,")).toBe(false)
    })

    it('ignores a line with no brackets', () => {
      expect(hasFoldableSpan('const a = b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r')).toBe(false)
    })
  })

  describe('isFoldableCommand', () => {
    it('finds a command with two or more flags', () => {
      expect(isFoldableCommand('npx @hyperfrontend/features build --protocol v4 --out dist/shell')).toBe(true)
    })

    it('finds a command with six or more words', () => {
      expect(isFoldableCommand(WIDE_COMMAND)).toBe(true)
    })

    it('ignores a short command with one flag', () => {
      expect(isFoldableCommand('npx nx serve demo-clock --port=4283')).toBe(false)
    })

    it('counts a quoted argument as one word', () => {
      expect(isFoldableCommand('echo "one two three four five six seven eight nine ten"')).toBe(false)
    })
  })

  describe('findWideLines', () => {
    it('reports an object literal past the floor', () => {
      expect(findWideLines(WIDE_OBJECT, 'typescript', 80, 140)).toEqual([{ index: 0, width: WIDE_OBJECT.length, shape: 'entries' }])
    })

    it('reports a command past the floor', () => {
      expect(findWideLines(WIDE_COMMAND, 'bash', 80, 140)).toEqual([{ index: 0, width: WIDE_COMMAND.length, shape: 'command' }])
    })

    it('reports the offset of each wide line', () => {
      expect(findWideLines(`short\n${WIDE_OBJECT}\nshort\n${WIDE_OBJECT}`, 'ts', 80, 140)).toEqual([
        expect.objectContaining({ index: 1 }),
        expect.objectContaining({ index: 3 }),
      ])
    })

    it('ignores every line of an output block', () => {
      expect(findWideLines(WIDE_OBJECT, 'text', 80, 140)).toEqual([])
    })

    it('ignores a line at the floor', () => {
      expect(findWideLines(WIDE_OBJECT, 'typescript', WIDE_OBJECT.length, 140)).toEqual([])
    })

    it('ignores a line past the ceiling', () => {
      expect(findWideLines(WIDE_OBJECT, 'typescript', 80, WIDE_OBJECT.length - 1)).toEqual([])
    })

    it('ignores an exempt line in a code block', () => {
      expect(findWideLines(WIDE_SIGNATURE, 'typescript', 80, 140)).toEqual([])
    })

    it('ignores an exempt line in a shell block', () => {
      expect(findWideLines(WIDE_URL, 'bash', 80, 140)).toEqual([])
    })

    it('ignores a shell line that is not a foldable command', () => {
      expect(findWideLines('echo "a sentence that is long enough to cross the floor but has no flags at all"', 'sh', 60, 140)).toEqual([])
    })

    it('ignores a code line with no foldable span', () => {
      expect(findWideLines('const a = b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r + s + t', 'js', 80, 140)).toEqual(
        []
      )
    })
  })

  describe('rule', () => {
    it('reports a wide object literal with its width and position', () => {
      expect(lintMarkdown(fenced('typescript', 'const a = 1', WIDE_OBJECT))).toEqual([
        {
          node: expect.anything(),
          messageId: 'entries',
          data: { width: `${WIDE_OBJECT.length}` },
          loc: { start: { line: 5, column: 0 }, end: { line: 5, column: WIDE_OBJECT.length } },
        },
      ])
    })

    it('reports a wide command with the command message', () => {
      expect(lintMarkdown(fenced('bash', WIDE_COMMAND))).toEqual([expect.objectContaining({ messageId: 'command' })])
    })

    it('carries the fence indentation into the column', () => {
      expect(lintMarkdown(`- step\n\n  \`\`\`ts\n  ${WIDE_OBJECT}\n  \`\`\`\n`)).toEqual([
        expect.objectContaining({ loc: expect.objectContaining({ start: { line: 4, column: 2 } }) }),
      ])
    })

    it('reports nothing for a narrow block', () => {
      expect(lintMarkdown(fenced('typescript', 'const a = 1'))).toEqual([])
    })

    it('reads the fence language case-insensitively', () => {
      expect(lintMarkdown(fenced('TEXT', WIDE_OBJECT))).toEqual([])
    })

    it('treats a fence with no language as code', () => {
      expect(lintMarkdown(fenced('', WIDE_OBJECT))).toEqual([expect.objectContaining({ messageId: 'entries' })])
    })

    it('honours a raised floor', () => {
      expect(lintMarkdown(fenced('typescript', WIDE_OBJECT), { minLineLength: 120 })).toEqual([])
    })

    it('honours a lowered ceiling', () => {
      expect(lintMarkdown(fenced('typescript', WIDE_OBJECT), { maxLineLength: 90 })).toEqual([])
    })

    it('registers no listeners for a file that is not markdown', () => {
      // @ts-expect-error - partial mock
      expect(rule.create({ filename: 'notes.txt', options: [] })).toEqual({})
    })

    it('reports without a location when the node carries none', () => {
      const reports: CapturedReport[] = []
      // @ts-expect-error - partial mock
      const listeners = rule.create({ filename: 'README.md', options: [], report: (d: CapturedReport) => reports.push(d) }) as ListenerMap
      listeners['code']?.({ type: 'code', lang: 'ts', value: WIDE_OBJECT })
      expect(reports).toEqual([{ node: expect.anything(), messageId: 'entries', data: { width: `${WIDE_OBJECT.length}` } }])
    })

    it('treats a node with no value as empty', () => {
      const reports: CapturedReport[] = []
      // @ts-expect-error - partial mock
      const listeners = rule.create({ filename: 'README.md', options: [], report: (d: CapturedReport) => reports.push(d) }) as ListenerMap
      listeners['code']?.({ type: 'code', lang: null })
      expect(reports).toEqual([])
    })
  })
})
