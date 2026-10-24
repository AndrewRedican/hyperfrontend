import type { InvalidCase, RuleCase } from '@hyperfrontend/linter/testing'
import type { ModuleBoundariesOptions } from './module-boundaries.ts'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, posix } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import rule, { allows } from './module-boundaries.ts'

// why: the rule reads the project graph the workspace's files draw, so the fixture is a disposable git workspace whose projects exercise each boundary.
const ROOT_DIR = createTempDir({ prefix: 'lint-boundaries-' })
const ROOT = ROOT_DIR.path
const BARE_DIR = createTempDir({ prefix: 'lint-boundaries-bare-' })
const BARE = BARE_DIR.path
const project = (root: string, name: string, tags: readonly string[], buildable: boolean, type = 'library'): string =>
  ROOT_DIR.write(
    posix.join(root, 'project.json'),
    JSON.stringify({ name, projectType: type, tags, targets: buildable ? { build: { executor: 'x:build' } } : {} })
  )

ROOT_DIR.write('.gitignore', 'node_modules\n')
ROOT_DIR.write('package.json', JSON.stringify({ name: '@ws/root', private: true, workspaces: ['libs/*'] }))
ROOT_DIR.write('project.json', JSON.stringify({ name: 'root', tags: [] }))
ROOT_DIR.write('lint.config.ts', 'export default []\n')
ROOT_DIR.write(
  'tsconfig.base.json',
  JSON.stringify({
    compilerOptions: {
      paths: {
        '@ws/core': ['libs/core/src/index.ts'],
        '@ws/core/deep': ['libs/core/src/deep.ts'],
        '@ws/core/gone': ['libs/core/src/gone.ts'],
        '@ws/util': ['libs/util/src/index.ts'],
        '@ws/plain': ['libs/plain/src/index.ts'],
        '@ws/untagged': ['libs/untagged/src/index.ts'],
        '@ws/a': ['libs/a/src/index.ts'],
        '@ws/b': ['libs/b/src/index.ts'],
        '@ws/app': ['apps/app/src/main.ts'],
        '@ws/lazy': ['libs/lazy/src/index.ts'],
        '@ws/feature': ['libs/feature/src/index.ts'],
        '@ws/loop': ['libs/loop/src/index.ts'],
        '@ws/wild/*': ['libs/wild/src/*'],
      },
    },
  })
)
project('libs/core', 'core', ['type:core'], true)
ROOT_DIR.write(
  'libs/core/package.json',
  JSON.stringify({ name: '@ws/core', exports: { '.': './src/index.ts', './deep': { import: './src/deep.ts' }, './x': null } })
)
ROOT_DIR.write('libs/core/src/index.ts', "export { deep } from './deep'\nexport { why } from './sub/y'\nexport const core = 1\n")
ROOT_DIR.write('libs/core/src/sub/y.ts', 'export const why = 4\n')
ROOT_DIR.write('libs/core/src/deep.ts', 'export const deep = 2\n')
ROOT_DIR.write('libs/core/src/inner.ts', 'export const inner = 3\n')
project('libs/util', 'util', ['type:util'], true)
ROOT_DIR.write('libs/util/src/index.ts', 'export const util = 1\n')
project('libs/plain', 'plain', ['type:util'], false)
ROOT_DIR.write('libs/plain/src/index.ts', 'export const plain = 1\n')
ROOT_DIR.write('libs/plain/package.json', JSON.stringify({ name: '@ws/plain-package' }))
project('libs/untagged', 'untagged', [], true)
ROOT_DIR.write('libs/untagged/src/index.ts', 'export const untagged = 1\n')
project('libs/a', 'a', ['type:util'], true)
ROOT_DIR.write('libs/a/src/index.ts', "import { b } from '@ws/b'\nexport const a = b\nexport const later = () => import('@ws/b')\n")
ROOT_DIR.write('libs/a/src/other.ts', "import { b } from '@ws/b'\nimport { core } from '@ws/core'\nexport const other = b + core\n")
project('libs/b', 'b', ['type:util'], true)
ROOT_DIR.write('libs/b/src/index.ts', "import { a } from '@ws/a'\nexport const b = 1\n")
project('apps/app', 'app', ['type:app'], false, 'application')
ROOT_DIR.write('apps/app/src/main.ts', 'export const main = 1\n')
project('libs/lazy', 'lazy', ['type:util'], true)
ROOT_DIR.write('libs/lazy/src/index.ts', "export const load = () => import('@ws/util')\nexport const loop = () => import('@ws/loop')\n")
project('libs/loop', 'loop', ['type:util'], true)
ROOT_DIR.write('libs/loop/src/index.ts', "export const back = () => import('@ws/lazy')\n")
project('libs/wild', 'wild', ['type:util'], true)
ROOT_DIR.write('libs/wild/src/thing.ts', 'export const thing = 1\n')
project('libs/feature', 'feature', ['type:feature'], true)
ROOT_DIR.write('libs/feature/src/index.ts', 'export const feature = 1\n')
execFileSync('git', ['init', '-q'], { cwd: ROOT })
BARE_DIR.write('tsconfig.base.json', '{}')
BARE_DIR.write('libs/only/project.json', JSON.stringify({ name: 'only', tags: [] }))
BARE_DIR.write('libs/only/src/index.ts', 'export const only = 1\n')
execFileSync('git', ['init', '-q'], { cwd: BARE })

/** The options the workspace configures. */
const OPTIONS: ModuleBoundariesOptions = {
  enforceBuildableLibDependency: true,
  allow: ['^.*/lint(\\.base)?\\.config\\.ts$', '^@ws/allowed(/.*)?$'],
  depConstraints: [
    { sourceTag: 'type:core', onlyDependOnLibsWithTags: [] },
    { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:core', 'type:util'] },
    { sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:core', 'type:util', 'type:feature'] },
    { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:util'] },
    { sourceTag: 'type:loose' },
  ],
}

/**
 * A one-line text linted as a file of the fixture workspace.
 *
 * @param name - What the case shows
 * @param file - The file, workspace-relative
 * @param text - The single statement linted
 * @param options - The options, the workspace's unless given
 * @returns The case
 */
function valid(name: string, file: string, text: string, options: ModuleBoundariesOptions = OPTIONS): RuleCase {
  return { name, path: join(ROOT, file), root: ROOT, text, options }
}

/**
 * A one-line text whose whole statement is reported.
 *
 * @param name - What the case shows
 * @param file - The file, workspace-relative
 * @param text - The single statement linted
 * @param message - The message expected
 * @param output - The fixed text, when a fix applies
 * @param options - The options, the workspace's unless given
 * @returns The case
 */
function invalid(
  name: string,
  file: string,
  text: string,
  message: string,
  output?: string,
  options: ModuleBoundariesOptions = OPTIONS
): InvalidCase {
  const lines = text.split(/\r?\n/)
  const last = lines[lines.length - 1] as string
  return {
    ...valid(name, file, text, options),
    errors: [{ message, line: 1, column: 1, endLine: lines.length, endColumn: last.length + 1 }],
    ...(output === undefined ? {} : { output }),
  }
}

const ACROSS = 'Projects cannot be imported by a relative or absolute path, and must begin with a npm scope'
const SELF = (specifier: string): string =>
  `Projects should use relative imports to import from other files within the same project. Use "./path/to/file" instead of import from "${specifier}"`

testRule(rule, {
  valid: [
    valid('an allowed import by pattern', 'libs/util/src/x.ts', "import config from '../../../lint.config.ts'"),
    valid('an import of an allowed package', 'libs/util/src/x.ts', "import '@ws/allowed/thing'"),
    valid('the root project without constraints', 'outside.ts', "import '@ws/core'", { allow: [] }),
    { name: 'an import with the options left out', path: join(ROOT, 'libs/util/src/x.ts'), root: ROOT, text: "import 'left-pad'" },
    {
      name: 'a file no project owns',
      path: join(BARE, 'outside.ts'),
      root: BARE,
      text: "import '../libs/only/src/index'",
      options: OPTIONS,
    },
    valid('a static import of a project reached through a dynamic cycle', 'libs/lazy/src/x.ts', "import { core } from '@ws/core'"),
    valid('an npm package', 'libs/util/src/x.ts', "import 'left-pad'"),
    valid('a builtin', 'libs/util/src/x.ts', "import { readFileSync } from 'node:fs'"),
    valid('a relative import within the project', 'libs/core/src/x.ts', "import { inner } from './inner'"),
    valid('an import of an allowed tag', 'libs/util/src/x.ts', "import { core } from '@ws/core'"),
    valid('an import with no options', 'libs/util/src/x.ts', "import { core } from '@ws/core'", {}),
    valid('a constraint without tag rules', 'libs/util/src/x.ts', "import { core } from '@ws/core'", {
      depConstraints: [{ sourceTag: 'type:util' }],
    }),
    valid('a wildcard constraint', 'libs/untagged/src/x.ts', "import { core } from '@ws/core'", {
      depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }],
    }),
    valid('a self import of an exported subpath', 'libs/core/src/x.ts', "import { deep } from '@ws/core/deep'"),
    valid('a type import of a lazily loaded project', 'libs/lazy/src/x.ts', "import type { util } from '@ws/util'"),
    valid('a dynamic import of a lazily loaded project', 'libs/lazy/src/x.ts', "const util = import('@ws/util')"),
    valid('a call of another function', 'libs/util/src/x.ts', "load('../../core/src/index')"),
    valid('a require without a string', 'libs/util/src/x.ts', 'require(name)'),
    valid('a require of a member other than resolve', 'libs/util/src/x.ts', "require.cache('../../core/src/index')"),
    valid('an export without a source', 'libs/util/src/x.ts', 'export const x = 1'),
    {
      name: 'a file outside any workspace',
      path: join(tmpdir(), 'lint-boundaries-none.ts'),
      root: tmpdir(),
      text: "import '../libs/core/src/index'",
      options: OPTIONS,
    },
  ],
  invalid: [
    invalid(
      'a relative import of another project, fixed to its alias',
      'libs/util/src/x.ts',
      "import { core, deep } from '../../core/src/index'",
      ACROSS,
      "import { core, deep } from '@ws/core';\nimport { deep } from '@ws/core/deep';"
    ),
    invalid('a relative import with nothing named', 'libs/util/src/x.ts', "import '../../core/src/index'", ACROSS),
    invalid('a relative import of a name no entry exports', 'libs/util/src/x.ts', "import { inner } from '../../core/src/inner'", ACROSS),
    invalid(
      'a relative import into a wildcard alias',
      'libs/util/src/x.ts',
      "import { thing } from '../../wild/src/thing'",
      ACROSS,
      "import { thing } from '@ws/wild/thing';"
    ),
    invalid('a require of another project by path', 'libs/util/src/x.ts', "require('../../core/src/index')", ACROSS),
    invalid('a require.resolve of another project by path', 'libs/util/src/x.ts', "require.resolve('../../core/src/index')", ACROSS),
    invalid('an absolute workspace path', 'libs/util/src/x.ts', "import { core } from 'libs/core/src/index'", ACROSS),
    invalid('an absolute workspace path no project holds', 'libs/util/src/x.ts', "import { gone } from '/libs/gone/index'", ACROSS),
    invalid('a relative import of the root project', 'libs/util/src/x.ts', "export * from '../../../outside'", ACROSS),
    invalid(
      'an absolute path outside the projects',
      'libs/util/src/x.ts',
      "import '/etc/passwd'",
      'External resources cannot be imported using a relative or absolute path'
    ),
    invalid(
      'a self import of the main alias, fixed to relative imports',
      'libs/core/src/sub/x.ts',
      "import { core, deep } from '@ws/core'",
      SELF('@ws/core'),
      "import { core } from '../index';\nimport { deep } from '../deep';"
    ),
    invalid(
      'a self import from a sibling file',
      'libs/core/src/x.ts',
      "import { deep } from '@ws/core'",
      SELF('@ws/core'),
      "import { deep } from './deep';"
    ),
    invalid('a self import with nothing named', 'libs/core/src/x.ts', "import '@ws/core'", SELF('@ws/core')),
    invalid(
      'a self import through a wildcard alias',
      'libs/wild/src/x.ts',
      "import { thing } from '@ws/wild/thing'",
      SELF('@ws/wild/thing'),
      "import { thing } from './thing';"
    ),
    invalid('a self import of a name nothing exports', 'libs/core/src/x.ts', "import { gone } from '@ws/core'", SELF('@ws/core')),
    invalid(
      'a self import of a name declared deeper',
      'libs/core/src/x.ts',
      "import { why } from '@ws/core'",
      SELF('@ws/core'),
      "import { why } from './sub/y';"
    ),
    invalid('a self import of a missing file', 'libs/core/src/x.ts', "import '@ws/core/gone'", SELF('@ws/core/gone')),
    invalid('a self import by package name', 'libs/plain/src/x.ts', "import { plain } from '@ws/plain-package'", SELF('@ws/plain-package')),
    invalid(
      'a relative import of a name written as a string',
      'libs/util/src/x.ts',
      "import { 'core' as c } from '../../core/src/index'",
      ACROSS
    ),
    {
      ...invalid('an absolute path into a missing project', 'libs/only/src/x.ts', "import '/libs/gone/index'", ACROSS),
      path: join(BARE, 'libs/only/src/x.ts'),
      root: BARE,
    },
    invalid(
      'an import closing a cycle',
      'libs/b/src/x.ts',
      "import { a } from '@ws/a'",
      'Circular dependency between "b" and "a" detected: b -> a -> b\n\nCircular file chain:\n- libs/b/src/x.ts\n- [\n    libs/a/src/index.ts,\n    libs/a/src/other.ts\n  ]'
    ),
    invalid(
      'an import closing a cycle through one file',
      'libs/a/src/x.ts',
      "import { b } from '@ws/b'",
      'Circular dependency between "a" and "b" detected: a -> b -> a\n\nCircular file chain:\n- libs/a/src/x.ts\n- libs/b/src/index.ts'
    ),
    invalid('an import of an application', 'libs/util/src/x.ts', "import { main } from '@ws/app'", 'Imports of apps are forbidden'),
    invalid(
      'a buildable library importing a non-buildable one',
      'libs/util/src/x.ts',
      "import { plain } from '@ws/plain'",
      'Buildable libraries cannot import or export from non-buildable libraries'
    ),
    invalid(
      'a static import of a lazily loaded project',
      'libs/lazy/src/x.ts',
      "import { util } from '@ws/util'",
      'Static imports of lazy-loaded libraries are forbidden.\n\nLibrary "util" is lazy-loaded in these files:\n- libs/lazy/src/index.ts'
    ),
    invalid(
      'a project no constraint governs',
      'libs/untagged/src/x.ts',
      "import { core } from '@ws/core'",
      'A project without tags matching at least one constraint cannot depend on any libraries'
    ),
    invalid(
      'an import of a disallowed tag',
      'libs/util/src/x.ts',
      "import { feature } from '@ws/feature'",
      'A project tagged with "type:util" can only depend on libs tagged with "type:core", "type:util"'
    ),
    invalid(
      'an import from a project allowed no tagged dependency',
      'libs/core/src/x.ts',
      "import { util } from '@ws/util'",
      'A project tagged with "type:core" cannot depend on any libs with tags'
    ),
  ],
})

describe('allows', () => {
  it('matches a prefix ending in two stars', () => {
    expect([allows('@ws/**', '@ws/a/b'), allows('@ws/**', '@other/a')]).toEqual([true, false])
  })

  it('matches one segment after a prefix ending in one star', () => {
    expect([allows('@ws/*', '@ws/a'), allows('@ws/*', '@ws/a/b'), allows('@ws/*', '@other/a')]).toEqual([true, false, false])
  })

  it('matches a prefix and a suffix around two stars', () => {
    expect([allows('@ws/**/x', '@ws/a/b/x'), allows('@ws/**/x', '@ws/a/y')]).toEqual([true, false])
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    ROOT_DIR.remove()
    BARE_DIR.remove()
    expect(existsSync(ROOT) || existsSync(BARE)).toBe(false)
  })
})
