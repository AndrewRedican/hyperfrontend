import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { PRODUCTION_EXCLUSIONS, Role, roleOf } from './roles'

/** The `nx.json` fields the guard reads. */
interface NxJson {
  readonly namedInputs: Readonly<Record<string, readonly string[]>>
}

const WORKSPACE_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..')

describe('roleOf', () => {
  it.each([
    ['libs/logging/src/create-logger.ts', 'libs/logging', Role.Production],
    ['libs/logging/src/create-logger.spec.ts', 'libs/logging', Role.Spec],
    ['libs/logging/src/create-logger.test.tsx', 'libs/logging', Role.Spec],
    ['libs/logging/src/create-logger.spec.ts.snap', 'libs/logging', Role.Spec],
    ['libs/logging/src/spec.ts', 'libs/logging', Role.Spec],
    ['libs/logging/src/specs.ts', 'libs/logging', Role.Production],
    ['libs/logging/src/inspect.ts', 'libs/logging', Role.Production],
    ['libs/logging/src/odd..ts', 'libs/logging', Role.Production],
    ['libs/logging/src/__test-utils__/fixtures.ts', 'libs/logging', Role.Spec],
    ['libs/logging/test.config.ts', 'libs/logging', Role.TestConfig],
    ['libs/logging/tsconfig.spec.json', 'libs/logging', Role.TestConfig],
    ['libs/logging/src/test-setup.ts', 'libs/logging', Role.TestConfig],
    ['libs/logging/test-setup.js', 'libs/logging', Role.TestConfig],
    ['libs/logging/src/nested/test-setup.ts', 'libs/logging', Role.Production],
    ['libs/logging/lint.config.ts', 'libs/logging', Role.LintConfig],
    ['lint.base.config.ts', '.', Role.LintConfig],
    ['libs/logging/project.json', 'libs/logging', Role.BuildConfig],
    ['libs/logging/package.json', 'libs/logging', Role.BuildConfig],
    ['libs/logging/tsconfig.lib.json', 'libs/logging', Role.BuildConfig],
    ['nx.json', '.', Role.BuildConfig],
    ['tsconfig.base.json', '.', Role.BuildConfig],
    ['tools/workspace/scripts/replay-affected.ts', 'tools/workspace', Role.Script],
    ['libs/logging/README.md', 'libs/logging', Role.Docs],
    ['libs/logging/docs/rules/no-direct-console.md', 'libs/logging', Role.Docs],
    ['apps/docs-site/docs/guide.yaml', 'apps/docs-site', Role.Docs],
    ['libs/logging/bin/log.ts', 'libs/logging', Role.Production],
    ['libs/logging/src/types.d.ts', 'libs/logging', Role.Production],
    ['libs/logging/src/worker.mjs', 'libs/logging', Role.Production],
    ['assets/media/logging/banner.svg', '.', Role.Asset],
    ['libs/logging/src/schema.json', 'libs/logging', Role.Asset],
    ['libs/logging/src/style.css', 'libs/logging', Role.Asset],
    ['libs/logging/src/scripts/helper.ts', 'libs/logging', Role.Production],
  ])('classifies %s as %s', (file, projectRoot, role) => {
    expect(roleOf(file, projectRoot)).toBe(role)
  })

  it('reads a file outside the given root against the whole path', () => {
    expect(roleOf('libs/other/src/a.spec.ts', 'libs/logging')).toBe(Role.Spec)
  })
})

describe('PRODUCTION_EXCLUSIONS', () => {
  it('lists exactly the exclusions of the production named input in nx.json', () => {
    const nx = parse(readFileSync(resolve(WORKSPACE_ROOT, 'nx.json'), 'utf8')) as NxJson
    expect(nx.namedInputs['production']?.filter((input) => input.startsWith('!'))).toEqual([...PRODUCTION_EXCLUSIONS])
  })
})
