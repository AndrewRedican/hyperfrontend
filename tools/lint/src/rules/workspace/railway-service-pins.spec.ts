import { existsSync } from 'node:fs'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createRailwayWorkspaces } from './__test-utils__/railway-workspace.ts'
import rule from './railway-service-pins.ts'

const workspaces = createRailwayWorkspaces()
const CLEAN = workspaces.file('clean', '.railway/railway.ts')
const LOCKS = workspaces.file('locks', '.railway/railway.ts')

/**
 * A service declaration serving through a start command.
 *
 * @param name - What the Railway project calls the service
 * @param start - The start command
 * @returns The declaration's source
 */
const service = (name: string, start: string): string => `service('${name}', { build: {}, start: '${start}' })`

/**
 * A start command serving through a pin.
 *
 * @param pin - The pin after the package name
 * @returns The command
 */
const serve = (pin: string): string => `npx -y @hyperfrontend/features@${pin} serve --root dist`

/**
 * The single-line error a case's text gives at the first occurrence of a span.
 *
 * @param text - The case's text, on one line
 * @param span - The reported text
 * @param message - What the rule reports there
 * @returns The expected error
 */
const at = (
  text: string,
  span: string,
  message: string
): { message: string; line: number; column: number; endLine: number; endColumn: number } => {
  const column = text.indexOf(span) + 1
  return { message, line: 1, column, endLine: 1, endColumn: column + span.length }
}

const PINNED = service('alpha', serve('1.2.3'))
const IGNORED = `github('o/r', {}); ctx.service('x', {}); service(name, {}); service(1, {}); service('y', options); ${PINNED}`
const STALE = service('alpha', serve('1.2.2'))
const RANGE = service('alpha', serve('^1.2.3'))
const UNPINNED = service('alpha', 'npx serve')
const SPREAD = "service('alpha', { ...base, start: `npx -y @hyperfrontend/features@1.2.3 serve` })"
const STARTLESS = "service('alpha', { ...base, build: {} })"
const UNKNOWN = `${PINNED}; ${service('omega', serve('9.9.9'))}`
const LOCKLESS = [service('beta', serve('1.2.3')), service('gamma', serve('1.2.4')), service('delta', serve('1.2.5'))].join('; ')

testRule(rule, {
  valid: [
    { name: 'a pin equal to the release the demo installs', path: CLEAN, text: PINNED },
    { name: 'calls that declare no literal service', path: CLEAN, text: IGNORED },
    { name: 'a railway.ts outside a .railway directory', path: workspaces.file('clean', 'apps/railway.ts'), text: STALE },
    { name: 'another file of the .railway directory', path: workspaces.file('clean', '.railway/other.ts'), text: STALE },
  ],
  invalid: [
    {
      name: 'a pin behind the release the demo installs',
      path: CLEAN,
      text: STALE,
      errors: [
        at(
          STALE,
          '1.2.2',
          "Service 'alpha' serves @hyperfrontend/features@1.2.2 but demo-alpha installs 1.2.3 from the registry; the pin must be the published version the demo was built with."
        ),
      ],
      output: PINNED,
    },
    {
      name: 'a range pin',
      path: CLEAN,
      text: RANGE,
      errors: [at(RANGE, `'${serve('^1.2.3')}'`, "Service 'alpha' must serve through an exact @hyperfrontend/features@<version> pin.")],
    },
    {
      name: 'a start command without the package',
      path: CLEAN,
      text: UNPINNED,
      errors: [at(UNPINNED, "'npx serve'", "Service 'alpha' must serve through an exact @hyperfrontend/features@<version> pin.")],
    },
    {
      name: 'a start command written as a template',
      path: CLEAN,
      text: SPREAD,
      errors: [
        at(
          SPREAD,
          '{ ...base, start: `npx -y @hyperfrontend/features@1.2.3 serve` }',
          "Service 'alpha' must serve through an exact @hyperfrontend/features@<version> pin."
        ),
      ],
    },
    {
      name: 'a service without a start command',
      path: CLEAN,
      text: STARTLESS,
      errors: [
        at(STARTLESS, '{ ...base, build: {} }', "Service 'alpha' must serve through an exact @hyperfrontend/features@<version> pin."),
      ],
    },
    {
      name: 'a service no demo deploys to',
      path: CLEAN,
      text: UNKNOWN,
      errors: [
        at(
          UNKNOWN,
          '9.9.9',
          "Service 'omega' matches no demo's metadata.deploy.service, so its pin cannot be checked against what the demo installs."
        ),
      ],
    },
    {
      name: 'a demo whose service the file does not declare',
      path: CLEAN,
      text: 'export default 1',
      errors: [
        at(
          'export default 1',
          'export default 1',
          "Project 'demo-alpha' deploys to Railway service 'alpha', which .railway/railway.ts does not declare."
        ),
      ],
    },
    {
      name: 'demos that install the package from no registry, or have no lock',
      path: LOCKS,
      text: LOCKLESS,
      errors: [
        at(
          LOCKLESS,
          '1.2.3',
          "Service 'beta' serves @hyperfrontend/features@1.2.3 but demo-beta installs no @hyperfrontend/features from the registry, so the pin cannot be checked."
        ),
        at(
          LOCKLESS,
          '1.2.4',
          "Service 'gamma' serves @hyperfrontend/features@1.2.4 but demo-gamma installs no @hyperfrontend/features from the registry, so the pin cannot be checked."
        ),
        at(
          LOCKLESS,
          '1.2.5',
          "Service 'delta' serves @hyperfrontend/features@1.2.5 but demo-delta installs no @hyperfrontend/features from the registry, so the pin cannot be checked."
        ),
      ],
    },
  ],
})

describe('the disposable workspaces', () => {
  it('are removed once the cases have run', () => {
    workspaces.remove()
    expect(existsSync(workspaces.root)).toBe(false)
  })
})
