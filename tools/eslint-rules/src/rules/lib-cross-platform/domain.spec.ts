import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempWorkspaceManager, createTypeScriptRuleTester } from '../../testing'
import rule, { RULE_NAME } from '../lib-cross-platform'
import { isPathLikeName, wordsOf } from './domain'
import { createCrossPlatformFiles } from './test-workspaces'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

const files = createCrossPlatformFiles(manager)

const ruleTester = createTypeScriptRuleTester()

describe('wordsOf', () => {
  it('splits camelCase, acronyms, snake_case, and kebab-case into lowercase words', () => {
    expect([wordsOf('XMLHttpRequest'), wordsOf('out-dir_name'), wordsOf('__dirname')]).toEqual([
      ['xml', 'http', 'request'],
      ['out', 'dir', 'name'],
      ['dirname'],
    ])
  })
})

describe('isPathLikeName', () => {
  it('accepts names whose last word is a path word', () => {
    expect(
      ['projectRoot', 'out_dir', 'cwd', 'PROJECT_ROOT', 'XMLPath', 'path', 'outputFilename', 'configDirectory', 'rootFolder'].filter(
        isPathLikeName
      )
    ).toHaveLength(9)
  })

  it('rejects names without a final path word or qualified as URLs and specifiers', () => {
    expect(
      ['', '___', 'fileName', 'paths', 'requestPath', 'decodeRequestPath', 'exportPath', 'urlRoot', 'importDir'].filter(isPathLikeName)
    ).toEqual([])
  })
})

/**
 * Wraps code that splits a value on `/` as a valid case in the Node project.
 *
 * @param name - The case name.
 * @param code - Source that splits a value which is not proven native on `/`.
 * @returns The valid test case.
 */
const notNative = (name: string, code: string) => ({ name, code, filename: files.node })

/**
 * Wraps code whose `split('/')` on a proven native value is fixed to `split(sep)`.
 *
 * @param name - The case name.
 * @param code - Source that splits a proven native value on `/`.
 * @param output - The fixed code.
 * @returns The invalid test case.
 */
const native = (name: string, code: string, output: string) => ({
  name,
  code,
  output,
  errors: [{ messageId: 'separatorLiteral' as const }],
  filename: files.node,
})

ruleTester.run(`${RULE_NAME} origins`, rule, {
  valid: [
    notNative('treats a let written twice as unknown', "import { join } from 'node:path'\nlet a = join(x)\na = other\na.split('/')"),
    notNative(
      'treats loop bindings as unknown',
      "import { join } from 'node:path'\nfor (const v of [join(x)]) v.split('/')\nfor (const k in o) k.split('/')"
    ),
    notNative(
      'treats destructured and parameter bindings as unknown',
      "import { join } from 'node:path'\nconst { a } = { a: join(x) }\na.split('/')\nfunction f(b) { b.split('/') }"
    ),
    notNative('treats bindings imported from other modules as unknown', "import { a } from './a'\na.split('/')"),
    notNative('treats path.win32 results as unknown', "import path from 'node:path'\npath.win32.join(x).split('/')"),
    notNative(
      'treats && results, unknown members, and non-string literals as unknown',
      "import { join } from 'node:path'\nconst v = flag && join(x)\nv.split('/')\nprocess.env.HOME.split('/');\n(1).split('/');\n(typeof x).split('/')"
    ),
    notNative('gives up on circular variables', "const a = b\nconst b = a\na.split('/')"),
    notNative(
      'ignores require bindings it cannot read',
      [
        'const m = require(name)',
        "m.join(x).split('/')",
        "const { [k]: j1 } = require('node:path')",
        "j1(x).split('/')",
        "const { join: j2 = f } = require('node:path')",
        "j2(x).split('/')",
        "const [j3] = require('node:path')",
        "j3(x).split('/')",
        "const j4 = notRequire('node:path')",
        "j4.join(x).split('/')",
        'const j5 = require(`node:path`)',
        "j5.join(x).split('/')",
      ].join('\n')
    ),
    notNative('ignores import-equals bindings', "import path = require('node:path')\npath.join(x).split('/')"),
    notNative('treats string-preserving methods on unknown values as unknown', "a.slice(1).split('/')"),
    notNative(
      'trusts portable helper output',
      "import { normalizePath } from '@hyperfrontend/project-scope/core/path'\nnormalizePath(x).split('/')"
    ),
    notNative('trusts node:path/posix output', "import { join } from 'node:path/posix'\njoin(x).split('/')"),
  ],
  invalid: [
    native('traces CommonJS path globals', "__filename.split('/')", "import { sep } from 'node:path'\n__filename.split(sep)"),
    native(
      'traces import.meta path properties',
      "import.meta.dirname.split('/')",
      "import { sep } from 'node:path'\nimport.meta.dirname.split(sep)"
    ),
    native(
      'traces import.meta.filename',
      "import.meta.filename.split('/')",
      "import { sep } from 'node:path'\nimport.meta.filename.split(sep)"
    ),
    native('traces require.resolve', "require.resolve('x').split('/')", "import { sep } from 'node:path'\nrequire.resolve('x').split(sep)"),
    native('traces the global process.cwd', "process.cwd().split('/')", "import { sep } from 'node:path'\nprocess.cwd().split(sep)"),
    native(
      'traces an imported process',
      "import process from 'node:process'\nprocess.cwd().split('/')",
      "import { sep } from 'node:path'\nimport process from 'node:process'\nprocess.cwd().split(sep)"
    ),
    native(
      'traces node:process cwd',
      "import { cwd } from 'node:process'\ncwd().split('/')",
      "import { sep } from 'node:path'\nimport { cwd } from 'node:process'\ncwd().split(sep)"
    ),
    native(
      'traces node:os directories',
      "import { homedir } from 'node:os'\nhomedir().split('/')",
      "import { homedir } from 'node:os'\nimport { sep } from 'node:path'\nhomedir().split(sep)"
    ),
    native(
      'traces fileURLToPath',
      "import { fileURLToPath } from 'node:url'\nfileURLToPath(u).split('/')",
      "import { sep } from 'node:path'\nimport { fileURLToPath } from 'node:url'\nfileURLToPath(u).split(sep)"
    ),
    native(
      'traces realpathSync',
      "import { realpathSync } from 'node:fs'\nrealpathSync(p).split('/')",
      "import { realpathSync } from 'node:fs'\nimport { sep } from 'node:path'\nrealpathSync(p).split(sep)"
    ),
    native(
      'traces destructured require bindings',
      "const { join } = require('node:path')\njoin(a).split('/')",
      "import { sep } from 'node:path'\nconst { join } = require('node:path')\njoin(a).split(sep)"
    ),
    native(
      'traces whole-module require bindings',
      "const path = require('node:path')\npath.join(a).split('/')",
      "import { sep } from 'node:path'\nconst path = require('node:path')\npath.join(a).split(sep)"
    ),
    native(
      'traces a let written once',
      "import { join } from 'node:path'\nlet a\na = join(x)\na.split('/')",
      "import { join, sep } from 'node:path'\nlet a\na = join(x)\na.split(sep)"
    ),
    native(
      'traces conditionals, fallbacks, sequences, and string-preserving methods',
      "import { join } from 'node:path'\nconst a = c ? join(x) : y\nconst b = y ?? a\nconst d = (y, b)\nd.trim().split('/')",
      "import { join, sep } from 'node:path'\nconst a = c ? join(x) : y\nconst b = y ?? a\nconst d = (y, b)\nd.trim().split(sep)"
    ),
    native(
      'traces templates interpolating a native path',
      "import { join } from 'node:path'\n`${join(x)}.ts`.split('/')",
      "import { join, sep } from 'node:path'\n`${join(x)}.ts`.split(sep)"
    ),
    native(
      'traces relative() as a native relative path',
      "import { relative } from 'node:path'\nrelative(a, b).split('/')",
      "import { relative, sep } from 'node:path'\nrelative(a, b).split(sep)"
    ),
    {
      ...native(
        'traces helpers configured by workspace-relative module',
        "import { toNative } from './paths/index'\ntoNative(x).split('/')",
        "import { sep } from 'node:path'\nimport { toNative } from './paths/index'\ntoNative(x).split(sep)"
      ),
      options: [{ helpers: [{ module: 'src/paths', native: ['toNative'] }] }],
    },
    native(
      'reuses an aliased separator import',
      "import { join, sep as SEP } from 'node:path'\njoin(a).split('/')",
      "import { join, sep as SEP } from 'node:path'\njoin(a).split(SEP)"
    ),
    native(
      'reuses a namespace import',
      "import * as path from 'node:path'\npath.join(a).split('/')",
      "import * as path from 'node:path'\npath.join(a).split(path.sep)"
    ),
    native(
      'reuses a default import next to named ones',
      "import path, { join } from 'node:path'\njoin(a).split('/')",
      "import path, { join } from 'node:path'\njoin(a).split(path.sep)"
    ),
    native(
      'appends to a bare path import',
      "import { join } from 'path'\njoin(a).split('/')",
      "import { join, sep } from 'path'\njoin(a).split(sep)"
    ),
    native(
      'adds a value import after type-only imports',
      "import type { ParsedPath } from 'node:path'\nprocess.cwd().split('/')",
      "import type { ParsedPath } from 'node:path'\nimport { sep } from 'node:path'\nprocess.cwd().split(sep)"
    ),
    native(
      'adds a value import before imports that sort after it',
      "import { x } from 'lodash'\nprocess.cwd().split('/')",
      "import { sep } from 'node:path'\nimport { x } from 'lodash'\nprocess.cwd().split(sep)"
    ),
    {
      name: 'reports without a fix when the separator import is shadowed',
      code: "import { join, sep } from 'node:path'\nfunction f(sep) {\n  return join(a).split('/')\n}",
      errors: [{ messageId: 'separatorLiteral' }],
      filename: files.node,
    },
    {
      name: 'falls back to the name when a shadowed process makes cwd unknown',
      code: "function f(process) {\n  process.cwd().split('/')\n}",
      errors: [
        {
          messageId: 'separatorLiteral',
          suggestions: [
            { messageId: 'treatAsNative', output: "import { sep } from 'node:path'\nfunction f(process) {\n  process.cwd().split(sep)\n}" },
            {
              messageId: 'treatAsPortable',
              output: "import { posix } from 'node:path'\nfunction f(process) {\n  process.cwd().split(posix.sep)\n}",
            },
          ],
        },
      ],
      filename: files.node,
    },
  ],
})
