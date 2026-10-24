import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import rule from './lib-tsconfig-paths.ts'

// why: the rule scans the workspace below the configuration file, so the fixture is a disposable workspace in the temporary directory.
const DIR = createTempDir({ prefix: 'lint-paths-' })
const ROOT = DIR.path
DIR.write('libs/a/project.json', '{ "name": "lib-a", "projectType": "library" }')
DIR.write(
  'libs/a/package.json',
  '{ "name": "@s/a", "exports": { ".": "./src/index.js", "./sub": { "import": "./src/sub/index.mjs" }, "./gone": "./src/gone/index.js", "./package.json": "./package.json" } }'
)
DIR.write('libs/a/src/index.ts', '')
DIR.write('libs/a/src/sub/index.mts', '')
DIR.write('libs/b/project.json', '{ "name": "lib-b", "projectType": "library" }')
DIR.write(
  'libs/b/package.json',
  '{ "name": "@s/b", "exports": { ".": "./src/index.cjs", "./x": { "default": "./src/x/index.js" }, "./y": { "types": "./src/y/index.js" }, "./w": "src/w/index.js", "./z": 1 } }'
)
DIR.write('libs/b/src/index.cts', '')
DIR.write('libs/b/src/w/index.ts', '')
DIR.write('libs/b/src/x/index.ts', '')
DIR.write('libs/b/src/y/index.ts', '')
DIR.write('libs/app/project.json', '{ "name": "app", "projectType": "application" }')
DIR.write('libs/app/package.json', '{ "name": "@s/app", "exports": { ".": "./src/index.js" } }')
DIR.write('libs/__fixtures__/c/project.json', '{ "name": "lib-c", "projectType": "library" }')
DIR.write('libs/__fixtures__/c/package.json', '{ "name": "@s/c", "exports": { ".": "./src/index.js" } }')
DIR.write('libs/__fixtures__/c/src/index.ts', '')
DIR.write('libs/noname/project.json', '{ "name": "lib-noname", "projectType": "library" }')
DIR.write('libs/noname/package.json', '{ "exports": { ".": "./src/index.js" } }')
DIR.write('libs/nomanifest/project.json', '{ "name": "lib-nomanifest", "projectType": "library" }')
DIR.write('tools/t/project.json', '{ "name": "tool", "projectType": "library" }')
DIR.write('tools/t/package.json', '{ "name": "@s/t", "exports": "./src/index.js" }')
DIR.write('plain/index.ts', '')
DIR.mkdir('libs/node_modules/skipped')
DIR.write('libs/node_modules/skipped/project.json', '{ "projectType": "library" }')

const CONFIG = join(ROOT, 'tsconfig.base.json')
const OPTIONS = { libraryDirectories: ['libs', 'tools', 'missing'], excludePatterns: ['__fixtures__'] }
const SOURCES: Record<string, string> = {
  '@s/a': 'libs/a/src/index.ts',
  '@s/a/sub': 'libs/a/src/sub/index.mts',
  '@s/b': 'libs/b/src/index.cts',
  '@s/b/w': 'libs/b/src/w/index.ts',
  '@s/b/x': 'libs/b/src/x/index.ts',
  '@s/b/y': 'libs/b/src/y/index.ts',
}
const COMPLETE = ['@s/a', '@s/a/sub', '@s/b', '@s/b/w', '@s/b/x', '@s/b/y']

// why: one alias line of the paths object, sources defaulting to the known file of the alias.
const entry = (alias: string, sources: readonly string[] = [SOURCES[alias] ?? '']): string =>
  `      "${alias}": [${sources.map((source) => `"${source}"`).join(', ')}]`

// why: a configuration whose paths object holds the given lines, the first at line 4.
const file = (lines: readonly string[]): string => `{\n  "compilerOptions": {\n    "paths": {\n${lines.join(',\n')}\n    }\n  }\n}\n`
const complete = file(COMPLETE.map((alias) => entry(alias)))

// why: where the paths object sits in a file with `count` alias lines, from line 3 to the closing brace.
const pathsObject = (count: number): { line: number; column: number; endLine: number; endColumn: number } => ({
  line: 3,
  column: 14,
  endLine: 4 + count,
  endColumn: 6,
})

// why: where the alias line at `index` sits, with `length` characters.
const aliasLine = (index: number, length: number): { line: number; column: number; endLine: number; endColumn: number } => ({
  line: 4 + index,
  column: 7,
  endLine: 4 + index,
  endColumn: 7 + length,
})

const missing = (packageName: string, exportKey: string, alias: string): string =>
  `Library '${packageName}' export '${exportKey}' is missing from tsconfig.base.json paths. Expected path alias '${alias}' → '${SOURCES[alias] ?? ''}'.`

testRule(rule, {
  valid: [
    { name: 'every export mapped, grouped by package', path: CONFIG, text: complete, options: OPTIONS },
    {
      name: 'a manual mapping to a file that exists',
      path: CONFIG,
      text: file([...COMPLETE.map((alias) => entry(alias)), entry('plain', ['plain/index.ts'])]),
      options: OPTIONS,
    },
    {
      name: 'a known package alias without sources, beside its package',
      path: CONFIG,
      text: file([entry('@s/a'), entry('@s/a/sub'), entry('@s/a/empty', []), ...COMPLETE.slice(2).map((alias) => entry(alias))]),
      options: OPTIONS,
    },
    { name: 'a paths object outside compilerOptions', path: CONFIG, text: '{ "other": { "paths": {} } }', options: OPTIONS },
    { name: 'paths that are no object', path: CONFIG, text: '{ "compilerOptions": { "paths": [] } }', options: OPTIONS },
    {
      name: 'a file that is no base configuration',
      path: join(ROOT, 'tsconfig.json'),
      text: '{ "compilerOptions": { "paths": {} } }',
      options: OPTIONS,
    },
    {
      name: 'no library directories configured',
      path: CONFIG,
      text: '{ "compilerOptions": { "paths": {} } }',
      options: { libraryDirectories: [] },
    },
    { name: 'no options', path: CONFIG, text: '{ "compilerOptions": { "paths": {} } }' },
  ],
  invalid: [
    {
      name: 'a stale alias alone, with no libraries configured, removed to leave an empty object',
      path: CONFIG,
      text: file([entry('x', ['nowhere'])]),
      options: { libraryDirectories: ['missing'] },
      errors: [
        {
          message: "Path mapping 'x' does not match any library and the file does not exist: 'nowhere'. Remove this stale mapping.",
          ...aliasLine(0, 16),
        },
      ],
      output: '{\n  "compilerOptions": {\n    "paths": {\n    }\n  }\n}\n',
    },
    {
      name: 'a missing export, reported on the paths object and fixed by rewriting it',
      path: CONFIG,
      text: file(COMPLETE.filter((alias) => alias !== '@s/a/sub').map((alias) => entry(alias))),
      options: OPTIONS,
      errors: [{ message: missing('@s/a', './sub', '@s/a/sub'), ...pathsObject(5) }],
      output: complete,
    },
    {
      name: 'several missing exports, fixed together by the first',
      path: CONFIG,
      text: file([entry('@s/b/y')]),
      options: OPTIONS,
      errors: [
        { message: missing('@s/a', '.', '@s/a'), ...pathsObject(1) },
        { message: missing('@s/a', './sub', '@s/a/sub'), ...pathsObject(1) },
        { message: missing('@s/b', '.', '@s/b'), ...pathsObject(1) },
        { message: missing('@s/b', './w', '@s/b/w'), ...pathsObject(1) },
        { message: missing('@s/b', './x', '@s/b/x'), ...pathsObject(1) },
      ],
      output: complete,
    },
    {
      name: 'a stale alias of a known package, removed with its line',
      path: CONFIG,
      text: file([...COMPLETE.map((alias) => entry(alias)), entry('@s/a/gone', ['libs/a/src/gone/index.ts'])]),
      options: OPTIONS,
      errors: [
        {
          message: "Path mapping '@s/a/gone' points to a file that does not exist: 'libs/a/src/gone/index.ts'. Remove this stale mapping.",
          ...aliasLine(6, 41),
        },
      ],
      output: complete,
    },
    {
      name: 'a stale alias first in the object, removed with the comma after it',
      path: CONFIG,
      text: file([entry('@s/a/gone', ['libs/a/src/gone/index.ts']), ...COMPLETE.map((alias) => entry(alias))]),
      options: OPTIONS,
      errors: [
        {
          message: "Path mapping '@s/a/gone' points to a file that does not exist: 'libs/a/src/gone/index.ts'. Remove this stale mapping.",
          ...aliasLine(0, 41),
        },
      ],
      output: complete,
    },
    {
      name: 'an alias of no known package whose file does not exist',
      path: CONFIG,
      text: file([...COMPLETE.map((alias) => entry(alias)), entry('unknown', ['nowhere/index.ts'])]),
      options: OPTIONS,
      errors: [
        {
          message:
            "Path mapping 'unknown' does not match any library and the file does not exist: 'nowhere/index.ts'. Remove this stale mapping.",
          ...aliasLine(6, 31),
        },
      ],
      output: complete,
    },
    {
      name: 'an alias without sources of no known package',
      path: CONFIG,
      text: file([...COMPLETE.map((alias) => entry(alias)), entry('unknown', [])]),
      options: OPTIONS,
      errors: [
        {
          message: "Path mapping 'unknown' does not match any library and the file does not exist: ''. Remove this stale mapping.",
          ...aliasLine(6, 13),
        },
      ],
      output: complete,
    },
    {
      name: 'aliases of one package split by another, reorganised',
      path: CONFIG,
      text: file(['@s/a', '@s/b', '@s/a/sub', '@s/b/w', '@s/b/x', '@s/b/y'].map((alias) => entry(alias))),
      options: OPTIONS,
      errors: [{ message: 'Path mappings for @s/a are not co-located. Reorganize paths to group them by package.', ...pathsObject(6) }],
      output: complete,
    },
    {
      name: 'a stale alias beside a missing one, both reported and the rewrite leaving the stale one out',
      path: CONFIG,
      text: file([
        ...COMPLETE.filter((alias) => alias !== '@s/a/sub').map((alias) => entry(alias)),
        entry('@s/b/gone', ['libs/b/src/gone/index.ts']),
      ]),
      options: OPTIONS,
      errors: [
        { message: missing('@s/a', './sub', '@s/a/sub'), ...pathsObject(6) },
        {
          message: "Path mapping '@s/b/gone' points to a file that does not exist: 'libs/b/src/gone/index.ts'. Remove this stale mapping.",
          ...aliasLine(5, 41),
        },
      ],
      output: complete,
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    DIR.remove()
    expect(existsSync(ROOT)).toBe(false)
  })
})
