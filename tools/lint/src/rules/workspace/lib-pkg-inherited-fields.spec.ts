import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { INHERITED_FIELDS as BUILD_FIELDS, packageRepository } from '@hyperfrontend/workspace/executors/build'
import { ROOT_FIELDS, createInheritedFieldsWorkspaces } from './__test-utils__/inherited-fields-workspaces.ts'
import rule, { INHERITED_FIELDS, gainsDirectory } from './lib-pkg-inherited-fields.ts'

const workspaces = createInheritedFieldsWorkspaces()
const ALPHA = workspaces.file('full', join('libs', 'alpha', 'package.json'))
const NAME = '@acme/alpha'
const REPOSITORY = { ...ROOT_FIELDS.repository, directory: 'libs/alpha' }
const BUGS = { url: 'https://example.invalid/acme/alpha/issues' }
const HOMEPAGE = 'https://example.invalid/acme/alpha#readme'
const AUTHOR = 'Somebody Else'

/** The message of each field in a workspace whose root manifest states its repository in full. */
const MESSAGES = {
  repository: `Remove "repository": the build writes it from the workspace's root manifest and adds this package's directory, so a value stated here is never published.`,
  bugs: `Remove "bugs": the build writes it from the workspace's root manifest, so a value stated here is never published.`,
  homepage: `Remove "homepage": the build writes it from the workspace's root manifest, so a value stated here is never published.`,
  author: `Remove "author": the build writes it from the workspace's root manifest, so a value stated here is never published.`,
} as const

/** The message of a repository where the root manifest states one the build cannot add a directory to. */
const UNPLACED = `Remove "repository": the build writes it from the workspace's root manifest, so a value stated here is never published.`

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

/** A reported property: its message and its text as the case writes it. */
type Reported = readonly [message: string, raw: string]

/**
 * A manifest as the formatter leaves it: two spaces a level and a final newline.
 *
 * @param fields - The manifest's fields in order
 * @returns The file text
 */
const manifest = (fields: Readonly<Record<string, unknown>>): string => `${stringify(fields, null, 2)}\n`

/**
 * A property of a manifest as the formatter leaves it.
 *
 * @param name - The field the property states
 * @param value - What it states for the field
 * @returns The text from the key's opening quote to the value's end
 */
const property = (name: string, value: unknown): string => `${stringify(name)}: ${stringify(value, null, 2).split(/\r?\n/).join('\n  ')}`

/**
 * The 1-based position of an offset in a text.
 *
 * @param text - The case's text
 * @param offset - How many characters precede the position
 * @returns The line and column
 */
const positionOf = (text: string, offset: number): { line: number; column: number } => ({
  line: text.slice(0, offset).split(/\r?\n/).length,
  column: offset - text.lastIndexOf('\n', offset - 1),
})

/**
 * The errors a text gives, one over each reported property.
 *
 * @param text - The case's text
 * @param reported - The reported properties in the order the text writes them
 * @returns The expected errors
 */
const errorsFor = (text: string, reported: readonly Reported[]): Expected[] => {
  let from = 0
  return reported.map(([message, raw]) => {
    const offset = text.indexOf(raw, from)
    from = offset + raw.length
    const start = positionOf(text, offset)
    const end = positionOf(text, from)
    return { message, line: start.line, column: start.column, endLine: end.line, endColumn: end.column }
  })
}

const ALL = { repository: REPOSITORY, bugs: BUGS, homepage: HOMEPAGE, author: AUTHOR }
const ALL_REPORTED: readonly Reported[] = [
  [MESSAGES.repository, property('repository', REPOSITORY)],
  [MESSAGES.bugs, property('bugs', BUGS)],
  [MESSAGES.homepage, property('homepage', HOMEPAGE)],
  [MESSAGES.author, property('author', AUTHOR)],
]
const STATES_ALL = manifest({ name: NAME, ...ALL })
const BETWEEN = manifest({ name: NAME, license: 'MIT', repository: REPOSITORY, sideEffects: false })
const FIRST = manifest({ repository: REPOSITORY, name: NAME, license: 'MIT' })
const LAST = manifest({ name: NAME, license: 'MIT', repository: REPOSITORY })
const ALONE = manifest({ repository: REPOSITORY })
const APART = manifest({
  repository: REPOSITORY,
  name: NAME,
  bugs: BUGS,
  version: '1.0.0',
  homepage: HOMEPAGE,
  license: 'MIT',
  author: AUTHOR,
})
const SIDE_BY_SIDE = manifest({ name: NAME, license: 'MIT', ...ALL, sideEffects: false })
const NOTHING_ELSE = manifest(ALL)
const TABBED = `${stringify({ name: NAME, homepage: HOMEPAGE, license: 'MIT' }, null, '\t')}\n`
const WINDOWS = manifest({ repository: 'github:acme/alpha', name: NAME, bugs: BUGS, license: 'MIT', author: AUTHOR }).replaceAll(
  '\n',
  '\r\n'
)
const ONE_LINE = '{ "name": "@acme/alpha", "repository": "github:acme/alpha", "type": "module" }\n'
const ONE_LINE_FIRST = '{"repository":"github:acme/alpha","name":"@acme/alpha"}'
const ONE_LINE_LAST = '{ "name": "@acme/alpha", "author": "Somebody Else" }\n'
const ONE_LINE_ALONE = '{ "homepage": "https://example.invalid/acme/alpha#readme" }\n'
const TWICE_APART = '{\n  "repository": "github:acme/first",\n  "name": "@acme/alpha",\n  "repository": "github:acme/last"\n}\n'
const TWICE_TOGETHER = '{\n  "name": "@acme/alpha",\n  "bugs": "first",\n  "bugs": "last",\n  "type": "module"\n}\n'
const MANY = [
  'repository',
  'bugs',
  'homepage',
  'author',
  'repository',
  'bugs',
  'homepage',
  'author',
  'repository',
  'bugs',
  'homepage',
  'author',
]
const MANY_TOGETHER = `{\n  "name": "@acme/alpha",\n${MANY.map((field) => `  "${field}": "a copy",\n`).join('')}  "type": "module"\n}\n`
const ROOT_STATES_LESS = manifest({ name: NAME, repository: REPOSITORY, bugs: BUGS, homepage: HOMEPAGE, author: AUTHOR, license: 'MIT' })
const ROOT_STATES_LESS_FIXED = manifest({ name: NAME, bugs: BUGS, homepage: HOMEPAGE, author: AUTHOR, license: 'MIT' })

testRule(rule, {
  valid: [
    {
      name: 'a publishable library that states none of the fields',
      path: ALPHA,
      text: manifest({ name: NAME, version: '1.0.0', license: 'MIT' }),
    },
    {
      name: 'a publishable library that writes the names below its top level or as part of another name',
      path: ALPHA,
      text: manifest({
        name: NAME,
        authors: [AUTHOR],
        publishConfig: { repository: REPOSITORY, homepage: HOMEPAGE },
        contributors: [{ author: AUTHOR, bugs: BUGS }],
      }),
    },
    {
      name: 'a tool, which is a library that is not published',
      path: workspaces.file('full', join('tools', 'gamma', 'package.json')),
      text: STATES_ALL,
    },
    { name: 'an application', path: workspaces.file('full', join('apps', 'site', 'package.json')), text: STATES_ALL },
    { name: 'an end-to-end project', path: workspaces.file('full', join('apps', 'alpha-e2e', 'package.json')), text: STATES_ALL },
    {
      name: 'a private package with no project file',
      path: workspaces.file('full', join('packages', 'private', 'package.json')),
      text: manifest({ name: 'private', private: true, ...ALL }),
    },
    {
      name: 'the root manifest, the source of the fields, of a workspace that is itself a publishable library',
      path: workspaces.file('full', 'package.json'),
      text: manifest({ name: 'workspace', ...ROOT_FIELDS }),
    },
    { name: 'a manifest with no directory above it to hold a workspace', path: workspaces.outside, text: STATES_ALL },
    {
      name: 'a file of a publishable library that is not its package.json',
      path: workspaces.file('full', join('libs', 'alpha', 'other.json')),
      text: STATES_ALL,
    },
    { name: 'a document that is no object', path: ALPHA, text: '["repository", "bugs", "homepage", "author"]\n' },
    {
      name: 'the fields a root manifest does not state, which the build publishes from the library',
      path: workspaces.file('shorthand', join('libs', 'alpha', 'package.json')),
      text: manifest({ name: NAME, bugs: BUGS, homepage: HOMEPAGE, author: AUTHOR }),
    },
    {
      name: 'a publishable library of a workspace with no root manifest',
      path: workspaces.file('bare', join('libs', 'alpha', 'package.json')),
      text: STATES_ALL,
    },
  ],
  invalid: [
    {
      name: 'a repository between other fields',
      path: ALPHA,
      text: BETWEEN,
      errors: errorsFor(BETWEEN, [ALL_REPORTED[0]]),
      output: manifest({ name: NAME, license: 'MIT', sideEffects: false }),
    },
    {
      name: 'a repository as the first field',
      path: ALPHA,
      text: FIRST,
      errors: errorsFor(FIRST, [ALL_REPORTED[0]]),
      output: manifest({ name: NAME, license: 'MIT' }),
    },
    {
      name: 'a repository as the last field',
      path: ALPHA,
      text: LAST,
      errors: errorsFor(LAST, [ALL_REPORTED[0]]),
      output: manifest({ name: NAME, license: 'MIT' }),
    },
    { name: 'a repository as the only field', path: ALPHA, text: ALONE, errors: errorsFor(ALONE, [ALL_REPORTED[0]]), output: '{}\n' },
    {
      name: 'each of the four fields, apart from one another',
      path: ALPHA,
      text: APART,
      errors: errorsFor(APART, ALL_REPORTED),
      output: manifest({ name: NAME, version: '1.0.0', license: 'MIT' }),
    },
    {
      name: 'the four fields side by side',
      path: ALPHA,
      text: SIDE_BY_SIDE,
      errors: errorsFor(SIDE_BY_SIDE, ALL_REPORTED),
      output: manifest({ name: NAME, license: 'MIT', sideEffects: false }),
    },
    {
      name: 'a manifest that states nothing but the four fields',
      path: ALPHA,
      text: NOTHING_ELSE,
      errors: errorsFor(NOTHING_ELSE, ALL_REPORTED),
      output: '{}\n',
    },
    {
      name: 'a field of a manifest indented with tabs',
      path: ALPHA,
      text: TABBED,
      errors: errorsFor(TABBED, [[MESSAGES.homepage, property('homepage', HOMEPAGE)]]),
      output: `${stringify({ name: NAME, license: 'MIT' }, null, '\t')}\n`,
    },
    {
      name: 'the first, a middle and the last field of a manifest with Windows line endings',
      path: ALPHA,
      text: WINDOWS,
      errors: errorsFor(WINDOWS, [
        [MESSAGES.repository, '"repository": "github:acme/alpha"'],
        [MESSAGES.bugs, property('bugs', BUGS).replaceAll('\n', '\r\n')],
        [MESSAGES.author, property('author', AUTHOR)],
      ]),
      output: manifest({ name: NAME, license: 'MIT' }).replaceAll('\n', '\r\n'),
    },
    {
      name: 'a field in the middle of a manifest written on one line',
      path: ALPHA,
      text: ONE_LINE,
      errors: errorsFor(ONE_LINE, [[MESSAGES.repository, '"repository": "github:acme/alpha"']]),
      output: '{ "name": "@acme/alpha", "type": "module" }\n',
    },
    {
      name: 'the first field of a manifest written on one line without spaces',
      path: ALPHA,
      text: ONE_LINE_FIRST,
      errors: errorsFor(ONE_LINE_FIRST, [[MESSAGES.repository, '"repository":"github:acme/alpha"']]),
      output: '{"name":"@acme/alpha"}',
    },
    {
      name: 'the last field of a manifest written on one line',
      path: ALPHA,
      text: ONE_LINE_LAST,
      errors: errorsFor(ONE_LINE_LAST, [[MESSAGES.author, '"author": "Somebody Else"']]),
      output: '{ "name": "@acme/alpha" }\n',
    },
    {
      name: 'the only field of a manifest written on one line',
      path: ALPHA,
      text: ONE_LINE_ALONE,
      errors: errorsFor(ONE_LINE_ALONE, [[MESSAGES.homepage, '"homepage": "https://example.invalid/acme/alpha#readme"']]),
      output: '{}\n',
    },
    {
      name: 'a field written twice, apart, each time it is written',
      path: ALPHA,
      text: TWICE_APART,
      errors: errorsFor(TWICE_APART, [
        [MESSAGES.repository, '"repository": "github:acme/first"'],
        [MESSAGES.repository, '"repository": "github:acme/last"'],
      ]),
      output: '{\n  "name": "@acme/alpha"\n}\n',
    },
    {
      name: 'a field written twice, side by side, each time it is written',
      path: ALPHA,
      text: TWICE_TOGETHER,
      errors: errorsFor(TWICE_TOGETHER, [
        [MESSAGES.bugs, '"bugs": "first"'],
        [MESSAGES.bugs, '"bugs": "last"'],
      ]),
      output: '{\n  "name": "@acme/alpha",\n  "type": "module"\n}\n',
    },
    {
      name: 'a dozen copies side by side, each one of them',
      path: ALPHA,
      text: MANY_TOGETHER,
      errors: errorsFor(
        MANY_TOGETHER,
        MANY.map((field) => [MESSAGES[field as keyof typeof MESSAGES], `"${field}": "a copy"`])
      ),
      output: '{\n  "name": "@acme/alpha",\n  "type": "module"\n}\n',
    },
    {
      name: 'only the repository where the root manifest states it alone, as one string the build adds no directory to',
      path: workspaces.file('shorthand', join('libs', 'alpha', 'package.json')),
      text: ROOT_STATES_LESS,
      errors: errorsFor(ROOT_STATES_LESS, [[UNPLACED, property('repository', REPOSITORY)]]),
      output: ROOT_STATES_LESS_FIXED,
    },
    {
      name: 'only the repository where the root manifest states it alone, as null',
      path: workspaces.file('nulled', join('libs', 'alpha', 'package.json')),
      text: ROOT_STATES_LESS,
      errors: errorsFor(ROOT_STATES_LESS, [[UNPLACED, property('repository', REPOSITORY)]]),
      output: ROOT_STATES_LESS_FIXED,
    },
  ],
})

describe('INHERITED_FIELDS', () => {
  it('names the fields the build executor takes from the root manifest, no more and no fewer', () => {
    expect([...INHERITED_FIELDS].sort()).toEqual([...BUILD_FIELDS].sort())
  })
})

describe('gainsDirectory', () => {
  it.each([
    ['an object with a url', { type: 'git', url: 'git+https://example.invalid/acme/workspace.git' }],
    [
      'an object with a url and a directory of its own',
      { url: 'git+https://example.invalid/acme/workspace.git', directory: 'packages/acme' },
    ],
    ['one string', 'github:acme/workspace'],
    ['a list', ['git+https://example.invalid/acme/workspace.git']],
    ['an object without a url', { type: 'git' }],
    ['an object whose url is no text', { type: 'git', url: 7 }],
    ['null', null],
    ['nothing', undefined],
  ])('answers whether the build executor adds a directory to a root repository stated as %s', (_case, stated) => {
    expect(gainsDirectory(stated)).toBe(packageRepository(stated, 'libs/alpha') !== stated)
  })
})

describe('the disposable workspaces', () => {
  it('are removed once the cases have run', () => {
    workspaces.remove()
    expect(existsSync(workspaces.root)).toBe(false)
  })
})
