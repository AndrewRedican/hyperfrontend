import { existsSync } from 'node:fs'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createNamedInputWorkspace } from './__test-utils__/named-input-workspace.ts'
import rule from './named-input-coverage.ts'

const workspace = createNamedInputWorkspace()
const HF = workspace.file('hf.json')
const SRC = '{projectRoot}/src'

/** A message with the position the rule must report it at. */
interface Expected {
  /** The message. */
  readonly message: string
  /** The 1-based start line. */
  readonly line: number
  /** The 1-based start column. */
  readonly column: number
  /** The 1-based end line. */
  readonly endLine: number
  /** The 1-based end column. */
  readonly endColumn: number
}

/**
 * The options that hold the `toolchain` input to a project's sources.
 *
 * @param outside - The globs declared outside the input
 * @param projectRoot - The project the input is checked against
 * @returns The rule's options
 */
const options = (outside: readonly string[] = [], projectRoot = 'libs/tool'): Record<string, unknown> => ({
  input: 'toolchain',
  projectRoot,
  outside,
})

/**
 * A workspace file on one line, defining named inputs.
 *
 * @param namedInputs - The named inputs by name
 * @returns The file text
 */
const hf = (namedInputs: Readonly<Record<string, unknown>>): string => stringify({ namedInputs })

/**
 * The errors a one-line text gives on the property that defines the `toolchain` input.
 *
 * @param entries - The input's value as the text wrote it
 * @param text - The case's text
 * @param messages - What the rule reports there, in order
 * @returns The expected errors
 */
const onInput = (entries: unknown, text: string, messages: readonly string[]): Expected[] => {
  const span = `"toolchain":${stringify(entries)}`
  const column = text.indexOf(span) + 1
  return messages.map((message) => ({ message, line: 1, column, endLine: 1, endColumn: column + span.length }))
}

/**
 * The error a text gives on the document as a whole.
 *
 * @param text - The case's text
 * @param message - What the rule reports there
 * @returns The expected error
 */
const onDocument = (text: string, message: string): Expected[] => {
  const lines = text.split(/\r?\n/)
  return [{ message, line: 1, column: 1, endLine: lines.length, endColumn: (lines.at(-1) as string).length + 1 }]
}

/**
 * The error a text gives when it does not define the `toolchain` input.
 *
 * @param text - The case's text
 * @returns The expected error
 */
const undefinedInput = (text: string): Expected[] =>
  onDocument(text, "Named input 'toolchain' is not defined, so nothing says which files of libs/tool it reads.")

/**
 * The error a text gives when the workspace cannot read it.
 *
 * @param text - The case's text
 * @returns The expected error
 */
const notStrict = (text: string): Expected[] =>
  onDocument(text, 'hf.json is not strict JSON, so the workspace reads no named input from it. Remove every comment and trailing comma.')

/**
 * The error a text gives when the rule's configuration leaves out an option it cannot work without.
 *
 * @param text - The case's text
 * @returns The expected error
 */
const unconfigured = (text: string): Expected[] =>
  onDocument(
    text,
    "This rule checks nothing without its 'input' and 'projectRoot' options: the named input to check and the project whose src directory it is checked against."
  )

/**
 * What the rule reports for a file or directory nothing decides.
 *
 * @param unit - The file or directory, workspace-relative
 * @returns The message
 */
const undecided = (unit: string): string =>
  `${unit} is neither read by named input 'toolchain' nor declared outside it. List it in the input when a change to it changes what a build emits; otherwise name it in this rule's 'outside' option.`

/**
 * What the rule reports for a named input the workspace could not read as a list.
 *
 * @param name - The named input
 * @returns The message
 */
const notList = (name: string): string =>
  `Named input '${name}' is not written as a list of inputs, so this rule cannot tell which files of libs/tool 'toolchain' reads.`

/**
 * What the rule reports for a named input that holds an entry the workspace could not read.
 *
 * @param name - The named input
 * @returns The message
 */
const notInput = (name: string): string =>
  `Named input '${name}' holds an entry that is not an input (a string, or an object whose 'fileset' or 'input' is a string), so this rule cannot tell which files of libs/tool 'toolchain' reads.`

const NO_README = '!{projectRoot}/**/README.md'
const WITHOUT_OUT = [
  `${SRC}/index.ts`,
  `${SRC}/emit/write.ts`,
  `${SRC}/emit/skip.ts`,
  `${SRC}/emit/logo.svg`,
  `${SRC}/watch/**/*`,
  NO_README,
]
const EVERY_FILE = [...WITHOUT_OUT, `${SRC}/emit/out/bundle.ts`]
const NEGATED = [`${SRC}/**/*`, `!${SRC}/emit/skip.ts`]
const EMIT_ONLY = [`${SRC}/emit/**/*`]
const NESTED = ['emitters', { fileset: `${SRC}/index.ts` }, { input: 'watchers' }, { input: 'nowhere' }, { dependencies: true }]
const CIRCULAR = ['toolchain', 'everything']
const WITHOUT_WATCH = [`${SRC}/index.ts`, `${SRC}/emit/**/*`]
const WITHOUT_DEEP = [`${SRC}/index.ts`, `${SRC}/emit/**/*`, `${SRC}/watch/poll.ts`]
const WITHOUT_SKIP = [
  `${SRC}/index.ts`,
  `${SRC}/emit/write.ts`,
  `${SRC}/emit/logo.svg`,
  `${SRC}/emit/out/**/*`,
  `${SRC}/watch/**/*`,
  NO_README,
]
const WITHOUT_BARREL = [`${SRC}/emit/**/*`, `${SRC}/watch/**/*`]
const EVERYTHING = [`${SRC}/**/*`]
const WITH_NEGATION = [`${SRC}/index.ts`, `${SRC}/emit/**/*`, NO_README]

const BUILT_IN_NAMES = ['constructor', { input: 'toString' }, `${SRC}/**/*`]
const KIT_BARREL = [`${SRC}/index.ts`]
const KIT_EVERYTHING = [`${SRC}/index.ts`, `${SRC}/templates/**/*`]
const KIT_NEGATED = [`${SRC}/index.ts`, `!${SRC}/templates/**/*`]
const KIT_NO_README = [`${SRC}/index.ts`, NO_README]
const KIT_MANIFEST = [`${SRC}/index.ts`, `${SRC}/templates/package.json`, NO_README]
const FILESET_FIRST = [{ fileset: `${SRC}/**/*`, input: 5 }]
const UNREADABLE_ENTRIES = [null, 5, [`${SRC}/**/*`], { fileset: 5 }, { input: 5 }]
const THROUGH_ANOTHER = [`${SRC}/**/*`, 'emitters', { input: 'watchers' }]

const NESTED_TEXT = hf({ emitters: [`${SRC}/emit/**/*`], watchers: [`${SRC}/watch/**/*`], toolchain: NESTED })
const CIRCULAR_TEXT = hf({ toolchain: CIRCULAR, everything: [{ input: 'toolchain' }, `${SRC}/**/*`] })
const OTHER_INPUT_TEXT = hf({ production: EVERYTHING })
const LIST_TEXT = stringify({ namedInputs: [] })
const COMMENTED_TEXT = `// what a build is made of\n${hf({ toolchain: EVERYTHING })}`
const TRAILING_COMMA_TEXT = `{"namedInputs":{"toolchain":${stringify(EVERYTHING)},}}`
const LAST_INPUT_TEXT = `{"namedInputs":{"toolchain":${stringify(WITHOUT_WATCH)},"toolchain":${stringify(EVERYTHING)}}}`
const LAST_INPUT_UNDECIDED_TEXT = `{"namedInputs":{"toolchain":${stringify(EVERYTHING)},"toolchain":${stringify(WITHOUT_WATCH)}}}`
const LAST_INPUTS_TEXT = `{"namedInputs":{"production":[]},"namedInputs":{"toolchain":${stringify(EVERYTHING)}}}`
const THROUGH_ANOTHER_TEXT = hf({ emitters: {}, watchers: [null], toolchain: THROUGH_ANOTHER })

testRule(rule, {
  valid: [
    {
      name: 'an input that reads every source file, beside a spec and a test helper it is never asked about and a document it negates',
      path: HF,
      text: hf({ toolchain: EVERY_FILE }),
      options: options(),
    },
    { name: 'a file the input negates', path: HF, text: hf({ toolchain: NEGATED }), options: options() },
    {
      name: 'a file the input negates that is also declared outside it',
      path: HF,
      text: hf({ toolchain: NEGATED }),
      options: options(['src/emit/skip.ts']),
    },
    {
      name: 'a file and a directory declared outside the input',
      path: HF,
      text: hf({ toolchain: EMIT_ONLY }),
      options: options(['src/index.ts', 'src/watch/**']),
    },
    {
      name: 'a directory named as build output is, declared outside the input',
      path: HF,
      text: hf({ toolchain: WITHOUT_OUT }),
      options: options(['src/emit/out/**']),
    },
    { name: 'a file that is not hf.json', path: workspace.file('other.json'), text: '{}' },
    { name: 'named inputs, filesets and input objects nested in the input', path: HF, text: NESTED_TEXT, options: options() },
    { name: 'an input that names itself, directly and through another', path: HF, text: CIRCULAR_TEXT, options: options() },
    { name: 'an input made of the default named input', path: HF, text: hf({ toolchain: ['default'] }), options: options() },
    {
      name: 'an input object that names the default named input',
      path: HF,
      text: hf({ toolchain: [{ input: 'default' }] }),
      options: options(),
    },
    {
      name: 'a default named input the file defines itself',
      path: HF,
      text: hf({ default: EVERYTHING, toolchain: ['default'] }),
      options: options(),
    },
    { name: 'entries spelled as the names every object inherits', path: HF, text: hf({ toolchain: BUILT_IN_NAMES }), options: options() },
    {
      name: 'an input object whose fileset is read before its input',
      path: HF,
      text: hf({ toolchain: FILESET_FIRST }),
      options: options(),
    },
    { name: 'an input written twice, the last one reading every file', path: HF, text: LAST_INPUT_TEXT, options: options() },
    { name: 'named inputs written twice, the last ones defining the input', path: HF, text: LAST_INPUTS_TEXT, options: options() },
    {
      name: 'a manifest, a compiler configuration and documents the input reads',
      path: HF,
      text: hf({ toolchain: KIT_EVERYTHING }),
      options: options([], 'libs/kit'),
    },
    {
      name: 'a manifest, a compiler configuration and documents declared outside the input, beside a test setup module never asked about',
      path: HF,
      text: hf({ toolchain: KIT_BARREL }),
      options: options(['src/templates/**'], 'libs/kit'),
    },
    {
      name: 'files a negation of the input keeps out, in a directory no pattern of it reads',
      path: HF,
      text: hf({ toolchain: KIT_NEGATED }),
      options: options([], 'libs/kit'),
    },
    {
      name: 'a project root written with a trailing slash and a leading dot',
      path: HF,
      text: hf({ toolchain: EVERY_FILE }),
      options: options([], './libs/tool/'),
    },
    {
      name: 'a configuration that declares nothing outside the input',
      path: HF,
      text: hf({ toolchain: EVERY_FILE }),
      options: { input: 'toolchain', projectRoot: 'libs/tool' },
    },
  ],
  invalid: [
    {
      name: 'a new directory, once for the files it holds',
      path: HF,
      text: hf({ toolchain: WITHOUT_WATCH }),
      options: options(),
      errors: onInput(WITHOUT_WATCH, hf({ toolchain: WITHOUT_WATCH }), [undecided('libs/tool/src/watch')]),
    },
    {
      name: 'the outermost directory the input reads nothing of',
      path: HF,
      text: hf({ toolchain: WITHOUT_DEEP }),
      options: options(),
      errors: onInput(WITHOUT_DEEP, hf({ toolchain: WITHOUT_DEEP }), [undecided('libs/tool/src/watch/deep')]),
    },
    {
      name: 'a new file in a directory the input partly reads',
      path: HF,
      text: hf({ toolchain: WITHOUT_SKIP }),
      options: options(),
      errors: onInput(WITHOUT_SKIP, hf({ toolchain: WITHOUT_SKIP }), [undecided('libs/tool/src/emit/skip.ts')]),
    },
    {
      name: 'a new directory named as build output is',
      path: HF,
      text: hf({ toolchain: WITHOUT_OUT }),
      options: options(),
      errors: onInput(WITHOUT_OUT, hf({ toolchain: WITHOUT_OUT }), [undecided('libs/tool/src/emit/out')]),
    },
    {
      name: 'a new file beside the directories',
      path: HF,
      text: hf({ toolchain: WITHOUT_BARREL }),
      options: options(),
      errors: onInput(WITHOUT_BARREL, hf({ toolchain: WITHOUT_BARREL }), [undecided('libs/tool/src/index.ts')]),
    },
    {
      name: 'an outside pattern over files the input reads, once',
      path: HF,
      text: hf({ toolchain: EVERYTHING }),
      options: options(['src/emit/**']),
      errors: onInput(EVERYTHING, hf({ toolchain: EVERYTHING }), [
        "'src/emit/**' is declared outside named input 'toolchain', yet the input reads libs/tool/src/emit/README.md.",
      ]),
    },
    {
      name: 'an outside pattern that matches no source file',
      path: HF,
      text: hf({ toolchain: EVERYTHING }),
      options: options(['src/gone/**', 'src/emit/write.spec.ts']),
      errors: onInput(EVERYTHING, hf({ toolchain: EVERYTHING }), [
        "'src/gone/**' is declared outside named input 'toolchain' but matches no source file of libs/tool.",
        "'src/emit/write.spec.ts' is declared outside named input 'toolchain' but matches no source file of libs/tool.",
      ]),
    },
    {
      name: 'undecided files first, then the outside patterns in the order written',
      path: HF,
      text: hf({ toolchain: EMIT_ONLY }),
      options: options(['src/gone/**', 'src/emit/write.ts', 'src/watch/**']),
      errors: onInput(EMIT_ONLY, hf({ toolchain: EMIT_ONLY }), [
        undecided('libs/tool/src/index.ts'),
        "'src/gone/**' is declared outside named input 'toolchain' but matches no source file of libs/tool.",
        "'src/emit/write.ts' is declared outside named input 'toolchain', yet the input reads libs/tool/src/emit/write.ts.",
      ]),
    },
    {
      name: 'a directory of a manifest, a compiler configuration and documents that the input reads nothing of',
      path: HF,
      text: hf({ toolchain: KIT_BARREL }),
      options: options([], 'libs/kit'),
      errors: onInput(KIT_BARREL, hf({ toolchain: KIT_BARREL }), [undecided('libs/kit/src/templates')]),
    },
    {
      name: 'a directory whose one decided file a negation keeps out, as the directory',
      path: HF,
      text: hf({ toolchain: KIT_NO_README }),
      options: options([], 'libs/kit'),
      errors: onInput(KIT_NO_README, hf({ toolchain: KIT_NO_README }), [undecided('libs/kit/src/templates')]),
    },
    {
      name: 'a document and a compiler configuration beside a manifest the input reads, each as the file',
      path: HF,
      text: hf({ toolchain: KIT_MANIFEST }),
      options: options([], 'libs/kit'),
      errors: onInput(KIT_MANIFEST, hf({ toolchain: KIT_MANIFEST }), [
        undecided('libs/kit/src/templates/NOTES.md'),
        undecided('libs/kit/src/templates/tsconfig.emit.json'),
      ]),
    },
    {
      name: 'an input written twice, on the last one',
      path: HF,
      text: LAST_INPUT_UNDECIDED_TEXT,
      options: options(),
      errors: onInput(WITHOUT_WATCH, LAST_INPUT_UNDECIDED_TEXT, [undecided('libs/tool/src/watch')]),
    },
    {
      name: 'an input written as an object',
      path: HF,
      text: hf({ toolchain: {} }),
      options: options(),
      errors: onInput({}, hf({ toolchain: {} }), [notList('toolchain')]),
    },
    {
      name: 'an input written as a number',
      path: HF,
      text: hf({ toolchain: 5 }),
      options: options(),
      errors: onInput(5, hf({ toolchain: 5 }), [notList('toolchain')]),
    },
    {
      name: 'entries that are no input, once however many the input holds',
      path: HF,
      text: hf({ toolchain: UNREADABLE_ENTRIES }),
      options: options(),
      errors: onInput(UNREADABLE_ENTRIES, hf({ toolchain: UNREADABLE_ENTRIES }), [notInput('toolchain')]),
    },
    {
      name: 'named inputs the input reads through that the workspace could not read, in the order met',
      path: HF,
      text: THROUGH_ANOTHER_TEXT,
      options: options(),
      errors: onInput(THROUGH_ANOTHER, THROUGH_ANOTHER_TEXT, [notList('emitters'), notInput('watchers')]),
    },
    {
      name: 'a new directory of a project whose root is written with a trailing slash, beside a negation that matches none of its files',
      path: HF,
      text: hf({ toolchain: WITH_NEGATION }),
      options: options([], 'libs/tool/'),
      errors: onInput(WITH_NEGATION, hf({ toolchain: WITH_NEGATION }), [undecided('libs/tool/src/watch')]),
    },
    {
      name: 'the files of a project whose directory name no pattern of the input can spell',
      path: HF,
      text: hf({ toolchain: WITH_NEGATION }),
      options: options([], 'libs/[beta]'),
      errors: onInput(WITH_NEGATION, hf({ toolchain: WITH_NEGATION }), [undecided('libs/[beta]/src/index.ts')]),
    },
    { name: 'a file that carries a comment', path: HF, text: COMMENTED_TEXT, options: options(), errors: notStrict(COMMENTED_TEXT) },
    {
      name: 'a file that carries a trailing comma',
      path: HF,
      text: TRAILING_COMMA_TEXT,
      options: options(),
      errors: notStrict(TRAILING_COMMA_TEXT),
    },
    {
      name: 'a configuration without options',
      path: HF,
      text: hf({ toolchain: EVERYTHING }),
      errors: unconfigured(hf({ toolchain: EVERYTHING })),
    },
    {
      name: 'a configuration that names no input',
      path: HF,
      text: hf({ toolchain: EVERYTHING }),
      options: { projectRoot: 'libs/tool', outside: [] },
      errors: unconfigured(hf({ toolchain: EVERYTHING })),
    },
    {
      name: 'a configuration that names no project',
      path: HF,
      text: hf({ toolchain: EVERYTHING }),
      options: { input: 'toolchain', outside: [] },
      errors: unconfigured(hf({ toolchain: EVERYTHING })),
    },
    {
      name: 'named inputs that do not define the input',
      path: HF,
      text: OTHER_INPUT_TEXT,
      options: options(),
      errors: undefinedInput(OTHER_INPUT_TEXT),
    },
    { name: 'a file without named inputs', path: HF, text: '{}', options: options(), errors: undefinedInput('{}') },
    { name: 'named inputs that are not an object', path: HF, text: LIST_TEXT, options: options(), errors: undefinedInput(LIST_TEXT) },
    { name: 'a document that is not an object', path: HF, text: '[]', options: options(), errors: undefinedInput('[]') },
    {
      name: 'a project without a src directory',
      path: HF,
      text: hf({ toolchain: EVERYTHING }),
      options: options([], 'libs/bare'),
      errors: onInput(EVERYTHING, hf({ toolchain: EVERYTHING }), [
        "libs/bare/src does not exist, so named input 'toolchain' cannot be checked against it.",
      ]),
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    workspace.remove()
    expect(existsSync(workspace.root)).toBe(false)
  })
})
