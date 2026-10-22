import { testRule } from '../../testing/rule-tester.ts'
import rule from './codeblock-line-width.ts'

const README = '/workspace/libs/pub/README.md'

// why: a document holding one fenced block, its first content line on line 4.
const fenced = (lang: string, ...code: string[]): string => `# Title\n\n\`\`\`${lang}\n${code.join('\n')}\n\`\`\`\n`

const WIDE_OBJECT = "const channel = createChannel('link', { send, receive, protocolProvider, session: nextSession, onDrop })"
const WIDE_COMMAND = 'npm uninstall commitizen cz-conventional-changelog @commitlint/cli @commitlint/config-conventional'
const WIDE_SIGNATURE = 'function createUnencryptedPacket<T = any>(origin: string, target: string, data: Data<T>): UnencryptedPacket<T>'
const WIDE_URL = 'git clone https://github.com/YOUR_USERNAME/hyperfrontend.git --depth 1 --branch main --single-branch'
const WIDE_CALL = 'const logger = createLogger(console.error, console.warn, console.log, console.info, console.debug)'
const TWO_FLAGS = 'npx @hyperfrontend/features build --protocol v4 --out dist/shell-output --watch --verbose'
const NESTED = 'const out = outer(first, inner(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s))'

const entries = (width: number): string =>
  `This code example is ${width} columns wide, an awkward width for mobile documentation. It holds a list that could stand one entry per line; consider formatting it vertically if doing so preserves clarity.`
const command = (width: number): string =>
  `This command is ${width} columns wide, an awkward width for mobile documentation. Consider continuing it over several lines with a trailing backslash if doing so preserves clarity.`

testRule(rule, {
  valid: [
    { name: 'a narrow block', path: README, text: fenced('typescript', 'const a = 1') },
    { name: 'an output block, read case-insensitively', path: README, text: fenced('TEXT', WIDE_OBJECT) },
    { name: 'a mermaid block', path: README, text: fenced('mermaid', `flowchart TD\n  A[${'node '.repeat(20)}] --> B[x, y, z]`) },
    { name: 'a line at the floor', path: README, text: fenced('typescript', WIDE_OBJECT), options: { minLineLength: WIDE_OBJECT.length } },
    {
      name: 'a line past the ceiling',
      path: README,
      text: fenced('typescript', WIDE_OBJECT),
      options: { maxLineLength: WIDE_OBJECT.length - 1 },
    },
    { name: 'a raised floor', path: README, text: fenced('typescript', WIDE_OBJECT), options: { minLineLength: 120 } },
    { name: 'a lowered ceiling', path: README, text: fenced('typescript', WIDE_OBJECT), options: { maxLineLength: 90 } },
    { name: 'a line carrying a url', path: README, text: fenced('bash', WIDE_URL) },
    {
      name: 'a line carrying a long token',
      path: README,
      text: fenced('typescript', "const digest = sha256('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', a, b)"),
    },
    {
      name: 'a comment',
      path: README,
      text: fenced('typescript', '// { inProgress: true, success: false, fail: false, halt: false, retries: 3 }'),
    },
    {
      name: 'a hash comment',
      path: README,
      text: fenced('typescript', '# a comment with a list (one, two, three, four, five, six, seven, eight)'),
    },
    {
      name: 'an import',
      path: README,
      text: fenced(
        'typescript',
        "import { createShell, DisplayMode, type ShellOptions, type ShellHandle } from '@hyperfrontend/features/host'"
      ),
    },
    { name: 'a function declaration', path: README, text: fenced('typescript', WIDE_SIGNATURE) },
    {
      name: 'a declaration after modifiers',
      path: README,
      text: fenced('typescript', 'declare async function load(a: string, b: string, c: string, dd: string): Promise<void>'),
    },
    {
      name: 'an anonymous function',
      path: README,
      text: fenced('typescript', 'function(first: string, second: string, third: string, fourth: string) {'),
    },
    {
      name: 'an exported type alias',
      path: README,
      text: fenced('typescript', 'export type QueueFailureHandler = (raw: unknown, reason: string, cause?: unknown) => void'),
    },
    {
      name: 'a function-typed member',
      path: README,
      text: fenced(
        'typescript',
        'seal: (key: CryptoKey, nonce: Uint8Array, additionalData: Uint8Array, plaintext: Uint8Array) => Promise<Uint8Array>'
      ),
    },
    {
      name: 'a method signature',
      path: README,
      text: fenced('typescript', 'request(type: string, data?: unknown, options?: RequestOptions): Promise<unknown>'),
    },
    {
      name: 'a generic method signature',
      path: README,
      text: fenced('typescript', 'create<T>(name: string, options: CreateOptions, extra: Extra, more: More): Result<T>'),
    },
    {
      name: 'a span with two entries',
      path: README,
      text: fenced('typescript', "const data = deserializeData(await createData(sessionPid, someVeryLongIdentifierName), 'x')"),
    },
    {
      name: 'commas inside a string',
      path: README,
      text: fenced('typescript', "log('one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve', level)"),
    },
    {
      name: 'an escaped quote inside a string',
      path: README,
      text: fenced('typescript', "log('it\\'s one, two, three, four, five, six, seven, eight, nine, ten, eleven', level)"),
    },
    {
      name: 'a short span however many entries it has',
      path: README,
      text: fenced('typescript', 'f(a, b, c, d) // and a comment that makes the line long enough to be looked at, really'),
    },
    {
      name: 'a span that never closes on the line',
      path: README,
      text: fenced('typescript', "createShell({ url, container, protocol: 'v4', sharedKey, onOpen, onClose, onError,"),
    },
    {
      name: 'a line with no brackets',
      path: README,
      text: fenced('typescript', 'const a = b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r + s + t'),
    },
    {
      name: 'a short shell command with one flag',
      path: README,
      text: fenced('bash', `npx nx serve demo-clock --port=4283 ${'#'.repeat(50)}`),
    },
    {
      name: 'a quoted argument counted as one word',
      path: README,
      text: fenced('sh', `echo "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen"`),
    },
    { name: 'modifiers with nothing after them', path: README, text: fenced('typescript', `declare async${' '.repeat(80)}`) },
    {
      name: 'a parameter list that never closes',
      path: README,
      text: fenced('typescript', 'create(name: string, options: CreateOptions, extra: Extra, more: MoreOptions, evenMore: Even'),
    },
  ],
  invalid: [
    {
      name: 'a wide object literal, with its width and position',
      path: README,
      text: fenced('typescript', 'const a = 1', WIDE_OBJECT),
      errors: [{ message: entries(WIDE_OBJECT.length), line: 5, column: 0, endLine: 5, endColumn: WIDE_OBJECT.length }],
    },
    {
      name: 'a wide call',
      path: README,
      text: fenced('ts', WIDE_CALL),
      errors: [{ message: entries(WIDE_CALL.length), line: 4, column: 0, endLine: 4, endColumn: WIDE_CALL.length }],
    },
    {
      name: 'a wide command',
      path: README,
      text: fenced('bash', WIDE_COMMAND),
      errors: [{ message: command(WIDE_COMMAND.length), line: 4, column: 0, endLine: 4, endColumn: WIDE_COMMAND.length }],
    },
    {
      name: 'a command with two flags',
      path: README,
      text: fenced('shell', TWO_FLAGS),
      errors: [{ message: command(TWO_FLAGS.length), line: 4, column: 0, endLine: 4, endColumn: TWO_FLAGS.length }],
    },
    {
      name: 'the fence indentation carried into the column',
      path: README,
      text: `- step\n\n  \`\`\`ts\n  ${WIDE_OBJECT}\n  \`\`\`\n`,
      errors: [{ message: entries(WIDE_OBJECT.length), line: 4, column: 2, endLine: 4, endColumn: 2 + WIDE_OBJECT.length }],
    },
    {
      name: 'a fence with no language, treated as code',
      path: README,
      text: fenced('', WIDE_OBJECT),
      errors: [{ message: entries(WIDE_OBJECT.length), line: 4, column: 0 }],
    },
    {
      name: 'a method whose body opens on the line',
      path: README,
      text: fenced('typescript', 'request(type: string, data?: unknown, options?: RequestOptions): Promise<unknown> {'),
      errors: [{ message: entries(83), line: 4, column: 0 }],
    },
    {
      name: 'a nested span counted toward the inner span, not the outer',
      path: README,
      text: fenced('typescript', NESTED),
      errors: [{ message: entries(NESTED.length), line: 4, column: 0 }],
    },
    {
      name: 'a tab counted as four columns',
      path: README,
      text: fenced('typescript', `\t\t\t\t\t${WIDE_CALL.slice(20)}`),
      errors: [{ message: entries(WIDE_CALL.length), line: 4, column: 0 }],
    },
    {
      name: 'an indented code block, whose first content line counts as its fence',
      path: README,
      text: `Intro:\n\n    ${WIDE_CALL}\n`,
      errors: [{ message: entries(WIDE_CALL.length), line: 4, column: 0, endLine: 4, endColumn: WIDE_CALL.length }],
    },
    {
      name: 'type parameters that never close, which is no signature',
      path: README,
      text: fenced('typescript', 'create<T(name: string, options: CreateOptions, extra: Extra, more: MoreOptions): Result'),
      errors: [{ message: entries(87), line: 4, column: 0 }],
    },
    {
      name: 'a line that does not open with an identifier',
      path: README,
      text: fenced('typescript', '(first: string, second: string, third: string, fourth: string, fifth: string): Result'),
      errors: [{ message: entries(85), line: 4, column: 0 }],
    },
    {
      name: 'every wide line of a block',
      path: README,
      text: fenced('ts', 'short', WIDE_OBJECT, 'short', WIDE_OBJECT),
      errors: [
        { message: entries(WIDE_OBJECT.length), line: 5, column: 0 },
        { message: entries(WIDE_OBJECT.length), line: 7, column: 0 },
      ],
    },
  ],
})
