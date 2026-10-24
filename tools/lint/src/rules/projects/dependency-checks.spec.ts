import type { ExpectedError, InvalidCase, RuleCase } from '@hyperfrontend/linter/testing'
import type { DependencyChecksOptions } from './dependency-checks.ts'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { createDependencyWorkspace } from './__test-utils__/dependency-workspace.ts'
import rule from './dependency-checks.ts'

const ROOT = createDependencyWorkspace()
// why: a workspace with no root project or root manifest is the only place a manifest belongs to no project, or a build reads no root manifest.
const BARE_DIR = createTempDir({
  prefix: 'lint-dependencies-bare-',
  tree: { 'tsconfig.base.json': '{}', 'libs/built/project.json': JSON.stringify({ name: 'built', targets: { build: {} } }) },
})
const BARE = BARE_DIR.path
BARE_DIR.mkdir('loose')
execFileSync('git', ['init', '-q'], { cwd: BARE })

const EXPECTED = ['@ws/dep', 'left-pad', 'inner', 'hoisted']
const ALL = '"@ws/dep":"2.0.0","left-pad":"1.3.0","inner":"0.0.1","hoisted":"2.0.0"'

/**
 * A manifest linted as the library's.
 *
 * @param name - What the case shows
 * @param text - The package.json content linted
 * @param options - The rule's options
 * @param file - The manifest's workspace-relative path
 * @returns The case
 */
function manifest(name: string, text: string, options?: DependencyChecksOptions, file = 'libs/lib/package.json'): RuleCase {
  return { name, path: join(ROOT, file), root: ROOT, text, ...(options === undefined ? {} : { options }) }
}

/**
 * The position of the first occurrence of a text in a one-line manifest.
 *
 * @param text - The manifest
 * @param needle - The text reported
 * @param message - The text the rule must report
 * @returns The expected error
 */
function at(text: string, needle: string, message: string): ExpectedError {
  const column = text.indexOf(needle) + 1
  return { message, line: 1, column, endLine: 1, endColumn: column + needle.length }
}

/**
 * An invalid manifest case.
 *
 * @param name - What the case shows
 * @param text - The manifest
 * @param errors - The errors expected
 * @param output - The fixed manifest
 * @param options - The rule's options
 * @returns The case
 */
function invalid(
  name: string,
  text: string,
  errors: readonly ExpectedError[],
  output: string,
  options?: DependencyChecksOptions
): InvalidCase {
  return { ...manifest(name, text, options), errors, output }
}

const MISSING = (section: string, names: readonly string[]): string =>
  `The "lib" project uses the following packages, but they are missing from "${section}":${names.map((name) => `\n    - ${name}`).join('')}`
const UNUSED = (name: string): string => `The "${name}" package is not used by "lib" project.`
const MISMATCH = (name: string, version: string): string =>
  `The version specifier does not contain the installed version of "${name}" package: ${version}.`
const SECTIONS = `Dependency sections are missing from the "package.json" but following dependencies were detected:${EXPECTED.map((name) => `\n- "${name}"`).join()}`
const LISTED = '\n    "@ws/dep": "2.0.0",\n    "hoisted": "2.0.0",\n    "inner": "0.0.1",\n    "left-pad": "1.3.0"'

const OBSOLETE = `{"dependencies":{"react":"1","@ws/dep":"2.0.0","lodash":"1",${ALL.slice(18)},"vue":"2"}}`
const MISMATCHED = '{"dependencies":{"@ws/dep":"2.0.0","left-pad":"^2.0.0","inner":"^1.0.0","hoisted":"latest"}}'
const PINNED = '{"dependencies":{"prerelease":"1.0.0-alpha.6","oddball":"1.0.0"}}'
const GAPS = '{"dependencies":{},"peerDependencies":"x"}'
const SHORT = '{"dependencies":{"left-pad":"1.3.0","inner":"0.0.1","hoisted":"2.0.0"}}'

testRule(rule, {
  valid: [
    manifest('a manifest declaring what the build uses', `{"name":"@ws/lib","dependencies":{${ALL}}}`),
    manifest(
      'ranges the installed versions satisfy and ranges never checked',
      '{"dependencies":{"@ws/dep":"file:../dep","left-pad":"*","inner":"workspace:*","hoisted":2}}'
    ),
    manifest('a manifest whose used packages are all ignored', '{"name":"x"}', { ignoredDependencies: EXPECTED }),
    manifest('a project file that is not a manifest', '{}', undefined, 'libs/lib/project.json'),
    manifest('a project without a build target', '{"dependencies":{"a":"1"}}', undefined, 'libs/nobuild/package.json'),
    manifest('a buildable project using nothing', '{"name":"q"}', undefined, 'libs/quiet/package.json'),
    manifest('a manifest that is not an object', '[]'),
    { name: 'a manifest outside any workspace', path: join(tmpdir(), 'package.json'), root: tmpdir(), text: '{"dependencies":{"a":"1"}}' },
    manifest('an ignored package declared', `{"dependencies":{${ALL},"typescript":"1"}}`, { ignoredDependencies: ['typescript'] }),
    {
      name: 'a buildable project in a workspace without a root manifest',
      path: join(BARE, 'libs/built/package.json'),
      root: BARE,
      text: '{}',
    },
    { name: 'a manifest no project owns', path: join(BARE, 'loose/package.json'), root: BARE, text: '{"dependencies":{"a":"1"}}' },
  ],
  invalid: [
    invalid(
      'a used package left out',
      SHORT,
      [at(SHORT, SHORT.slice(1, -1), MISSING('dependencies', ['@ws/dep']))],
      `${SHORT.slice(0, -2)},\n    "@ws/dep": "2.0.0"}}`
    ),
    invalid(
      'used packages left out of an empty section and a malformed one',
      GAPS,
      [
        at(GAPS, '"dependencies":{}', MISSING('dependencies', EXPECTED)),
        at(GAPS, '"peerDependencies":"x"', MISSING('peerDependencies', EXPECTED)),
      ],
      `{"dependencies":{\n    "@ws/dep": "2.0.0",\n    "left-pad": "1.3.0",\n    "inner": "0.0.1",\n    "hoisted": "2.0.0"\n  },"peerDependencies":"x"}`
    ),
    invalid(
      'declared packages nothing uses, first, between and last',
      OBSOLETE,
      [
        at(OBSOLETE, '"react":"1"', UNUSED('react')),
        at(OBSOLETE, '"lodash":"1"', UNUSED('lodash')),
        at(OBSOLETE, '"vue":"2"', UNUSED('vue')),
      ],
      `{"dependencies":{${ALL}}}`
    ),
    invalid(
      'the only declared package unused',
      '{"dependencies":{"react":"1"}}',
      [at('{"dependencies":{"react":"1"}}', '"react":"1"', UNUSED('react'))],
      '{"dependencies":{}}',
      {
        ignoredDependencies: EXPECTED,
      }
    ),
    invalid(
      'ranges the installed versions miss',
      MISMATCHED,
      [
        at(MISMATCHED, '"left-pad":"^2.0.0"', MISMATCH('left-pad', '1.3.0')),
        at(MISMATCHED, '"inner":"^1.0.0"', MISMATCH('inner', '0.0.1')),
        at(MISMATCHED, '"hoisted":"latest"', MISMATCH('hoisted', '2.0.0')),
      ],
      '{"dependencies":{"@ws/dep":"2.0.0","left-pad": "1.3.0","inner": "0.0.1","hoisted": "2.0.0"}}'
    ),
    {
      ...manifest('a prerelease pinned exactly beside a package installed at no version', PINNED, undefined, 'libs/pre/package.json'),
      errors: [at(PINNED, '"oddball":"1.0.0"', MISMATCH('oddball', 'next'))],
      output: PINNED.replace('"oddball":"1.0.0"', '"oddball": "next"'),
    },
    invalid(
      'a manifest without dependency sections',
      '{"name":"@ws/lib"}',
      [at('{"name":"@ws/lib"}', '{"name":"@ws/lib"}', SECTIONS)],
      `{"name":"@ws/lib",\n  "dependencies": {${LISTED}\n  }}`
    ),
    invalid('an empty manifest', '{}', [at('{}', '{}', SECTIONS)], `{\n  "dependencies": {${LISTED}\n  }\n}`),
    invalid(
      'a used package whose importing file is ignored',
      `{"dependencies":{${ALL}}}`,
      [at(`{"dependencies":{${ALL}}}`, '"@ws/dep":"2.0.0"', UNUSED('@ws/dep'))],
      `{"dependencies":{${ALL.slice(18)}}}`,
      { ignoredFiles: ['{projectRoot}/src/dep-user.ts'] }
    ),
  ],
})

describe('the disposable workspaces', () => {
  it('are removed at the end', () => {
    rmSync(ROOT, { recursive: true, force: true })
    BARE_DIR.remove()
    expect(existsSync(ROOT) || existsSync(BARE)).toBe(false)
  })
})
