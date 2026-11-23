import { existsSync } from 'node:fs'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createRailwayWorkspaces } from './__test-utils__/railway-workspace.ts'
import rule from './railway-service-pins.ts'

const workspaces = createRailwayWorkspaces()
const CLEAN = workspaces.file('clean', '.railway/railway.ts')
const LOCKS = workspaces.file('locks', '.railway/railway.ts')
const BUILT = workspaces.file('built', '.railway/railway.ts')
const STATED = workspaces.file('stated', '.railway/railway.ts')
const BARE = workspaces.file('bare', '.railway/railway.ts')
const QUOTED = workspaces.file('quoted', '.railway/railway.ts')
const TOKEN = workspaces.file('token', '.railway/railway.ts')
const KEYED = workspaces.file('keyed', '.railway/railway.ts')
const NAMED = workspaces.file('named', '.railway/railway.ts')
const SLASHED = workspaces.file('slashed', '.railway/railway.ts')
const MISNAMED = workspaces.file('misnamed', '.railway/railway.ts')
const SECOND = workspaces.file('second', '.railway/railway.ts')
const SPACED = workspaces.file('spaced', '.railway/railway.ts')
const NAMELESS = workspaces.file('nameless', '.railway/railway.ts')
const ANONYMOUS = workspaces.file('anonymous', '.railway/railway.ts')

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

/**
 * What the rule reports for a built service that starts with another command.
 *
 * @param name - What the Railway project calls the service
 * @param command - The command the service must start with
 * @returns The message
 */
const mustStart = (name: string, command: string): string =>
  `Service '${name}' must start with '${command}': a built service runs the main its build wrote, with nothing between the platform's signal and the process.`

/**
 * What the rule reports for a service whose pin cannot be read or is no exact version.
 *
 * @param name - What the Railway project calls the service
 * @returns The message
 */
const mustPin = (name: string): string => `Service '${name}' must serve through an exact @hyperfrontend/features@<version> pin.`

/**
 * A declaration of the built service `hello` beside the pinned service of its workspace.
 *
 * @param options - The source of the options object literal
 * @returns The file's source
 */
const hello = (options: string): string => `service('hello', ${options}); ${PINNED}`

const PINNED = service('alpha', serve('1.2.3'))
const IGNORED = `github('o/r', {}); ctx.service('x', {}); service(name, {}); service(1, {}); service('y', options); ${PINNED}`
const STALE = service('alpha', serve('1.2.2'))
const RANGE = service('alpha', serve('^1.2.3'))
const UNPINNED = service('alpha', 'npx serve')
const SPREAD = "service('alpha', { ...base, start: `npx -y @hyperfrontend/features@1.2.3 serve` })"
const STARTLESS = "service('alpha', { ...base, build: {} })"
const UNKNOWN = `${PINNED}; ${service('omega', serve('9.9.9'))}`
const MAIN = 'node dist/apps/hello/main.cjs'
const STARTED = `${service('hello', MAIN)}; ${PINNED}`
const THROUGH_NPX = `${service('hello', `npx ${MAIN}`)}; ${PINNED}`
const ARGUMENT = `${service('hello', `${MAIN} --port 8080`)}; ${PINNED}`
const MAINLESS = `service('hello', { build: {} }); ${PINNED}`
const TEMPLATE = `service('hello', { start: \`${MAIN}\` }); ${PINNED}`
const NULLED = `service('hello', { start: null }); ${PINNED}`
const STALE_BESIDE = `${service('hello', MAIN)}; ${STALE}`
const STATED_MAIN = service('stated', 'node out/stated/main.cjs')
const TARGETLESS = service('bare', 'node dist/apps/bare/main.cjs')
const QUOTED_MAIN = `node "dist/apps/o'brien/main.cjs"`
const SPACED_MAIN = 'node "dist/apps/my app/main.cjs"'
const UNQUOTED = service('spaced', 'node dist/apps/my app/main.cjs')
const NAMELESS_MAIN = service('nameless', 'node dist/apps/nameless/main.cjs')
const ANONYMOUS_STALE = service('anonymous', serve('1.2.2'))
const TOKEN_MAIN = 'node out/apps/token/main.cjs'
const KEYED_MAIN = 'node build/apps/keyed/main.cjs'
const NAMED_MAIN = 'node dist/apps/named/main.cjs'
const SLASHED_MAIN = 'node out/slashed/main.cjs'
const SECOND_MAIN = 'node out/second/main.cjs'
const UNRESOLVED = service('token', 'node out/{projectRoot}/main.cjs')
const UNDEFAULTED = service('keyed', 'node dist/apps/keyed/main.cjs')
const UNNAMED = service('named', 'npx serve')
const DOUBLED = service('slashed', 'node ./out/slashed//main.cjs')
const OTHER_TARGET = service('second', 'node out/bundle/main.cjs')
const MISNAMED_MAIN = service('misnamed', 'node dist/apps/misnamed/main.cjs')
const LAST = hello(`{ start: 'npx serve', start: '${MAIN}' }`)
const LAST_WRONG = hello(`{ start: '${MAIN}', start: 'npx serve' }`)
const SPREAD_FIRST = hello(`{ ...base, start: '${MAIN}' }`)
const SPREAD_LAST = hello(`{ start: '${MAIN}', ...base }`)
const SPREAD_BETWEEN = hello(`{ ...base, start: '${MAIN}', ...late, build: {} }`)
const SPREAD_ALONE = hello('{ ...base, build: {} }')
const KEY_QUOTED = hello(`{ 'build': {}, 'start': '${MAIN}' }`)
const KEY_QUOTED_WRONG = hello(`{ 'build': {}, "start": 'npx ${MAIN}' }`)
const KEY_COMPUTED = hello(`{ [start]: '${MAIN}' }`)
const KEY_COMPUTED_FIRST = hello(`{ [key]: 'npx serve', start: '${MAIN}' }`)
const KEY_COMPUTED_LAST = hello(`{ start: '${MAIN}', [key]: 'npx serve' }`)
const KEY_TEMPLATE_LAST = hello(`{ start: '${MAIN}', [\`start\`]: 'npx serve' }`)
const AS_CONST = hello(`{ start: '${MAIN}' as const }`)
const AS_CONST_WRONG = hello(`{ start: 'npx ${MAIN}' as const }`)
const WRAPPED = hello(`{ start: (('${MAIN}' as const) satisfies string)! }`)
const ANGLED = hello(`{ start: <const>'${MAIN}' }`)
const KEY_BRACKETED = hello(`{ ['start']: '${MAIN}' }`)
const WRAPPED_TEMPLATE = hello(`{ start: \`${MAIN}\` as const }`)
const PIN_LAST = `service('alpha', { start: 'npx serve', 'start': '${serve('1.2.3')}' as const })`
const PIN_STALE_LAST = `service('alpha', { start: '${serve('1.2.3')}', start: '${serve('1.2.2')}' as const })`
const PIN_SPREAD_LAST = `service('alpha', { start: '${serve('1.2.3')}', ...base })`
const PIN_KEY_FIRST = `service('alpha', { [key]: 'npx serve', start: '${serve('1.2.3')}' })`
const PIN_KEY_LAST = `service('alpha', { start: '${serve('1.2.3')}', [key]: 'npx serve' })`
const PIN_KEY_ALONE = `service('alpha', { [key]: '${serve('1.2.3')}' })`
const LOCKLESS = [service('beta', serve('1.2.3')), service('gamma', serve('1.2.4')), service('delta', serve('1.2.5'))].join('; ')

testRule(rule, {
  valid: [
    { name: 'a pin equal to the release the demo installs', path: CLEAN, text: PINNED },
    { name: 'calls that declare no literal service', path: CLEAN, text: IGNORED },
    { name: 'a railway.ts outside a .railway directory', path: workspaces.file('clean', 'apps/railway.ts'), text: STALE },
    { name: 'another file of the .railway directory', path: workspaces.file('clean', '.railway/other.ts'), text: STALE },
    { name: 'a built service starting the main of its default output', path: BUILT, text: STARTED },
    { name: 'a built service starting the main of its stated output path', path: STATED, text: STATED_MAIN },
    { name: 'a built service whose output path holds a token', path: TOKEN, text: service('token', TOKEN_MAIN) },
    { name: 'a built service whose output path a default of its executor gives', path: KEYED, text: service('keyed', KEYED_MAIN) },
    { name: 'a built service whose executor a default of the build target gives', path: NAMED, text: service('named', NAMED_MAIN) },
    { name: 'a built service whose output path ends in a slash', path: SLASHED, text: service('slashed', SLASHED_MAIN) },
    { name: 'a built service with another service target before its build', path: SECOND, text: service('second', SECOND_MAIN) },
    { name: 'a built service whose last start command is the main', path: BUILT, text: LAST },
    { name: 'a built service whose start command follows a spread', path: BUILT, text: SPREAD_FIRST },
    { name: 'a built service whose start key is quoted', path: BUILT, text: KEY_QUOTED },
    { name: 'a built service whose start command follows a computed key', path: BUILT, text: KEY_COMPUTED_FIRST },
    { name: 'a built service whose main is quoted for the space in its path', path: SPACED, text: service('spaced', SPACED_MAIN) },
    { name: 'a pin whose start command follows a computed key', path: CLEAN, text: PIN_KEY_FIRST },
    { name: 'a built service whose start command is asserted const', path: BUILT, text: AS_CONST },
    { name: 'a built service whose start command is wrapped in assertions and parentheses', path: BUILT, text: WRAPPED },
    { name: 'a built service whose start command is asserted in angle brackets', path: BUILT, text: ANGLED },
    { name: 'a built service whose start key is a string literal in brackets', path: BUILT, text: KEY_BRACKETED },
    { name: 'a pin read from the last start command, quoted and asserted const', path: CLEAN, text: PIN_LAST },
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
    {
      name: 'a built service started through npx',
      path: BUILT,
      text: THROUGH_NPX,
      errors: [at(THROUGH_NPX, `'npx ${MAIN}'`, mustStart('hello', MAIN))],
      output: STARTED,
    },
    {
      name: 'a built service started with an argument after the main',
      path: BUILT,
      text: ARGUMENT,
      errors: [at(ARGUMENT, `'${MAIN} --port 8080'`, mustStart('hello', MAIN))],
      output: STARTED,
    },
    {
      name: 'a built service without a start command',
      path: BUILT,
      text: MAINLESS,
      errors: [at(MAINLESS, '{ build: {} }', mustStart('hello', MAIN))],
    },
    {
      name: 'a built service whose start command is written as a template',
      path: BUILT,
      text: TEMPLATE,
      errors: [at(TEMPLATE, `\`${MAIN}\``, mustStart('hello', MAIN))],
    },
    {
      name: 'a built service whose start command is no string',
      path: BUILT,
      text: NULLED,
      errors: [at(NULLED, 'null', mustStart('hello', MAIN))],
    },
    {
      name: 'a project deployed as a built service that has no service target',
      path: BARE,
      text: TARGETLESS,
      errors: [
        at(
          TARGETLESS,
          "'bare'",
          "Service 'bare' deploys app-bare as a built service, but app-bare has no build target that runs @hyperfrontend/workspace:service."
        ),
      ],
    },
    {
      name: 'a static project behind its pin beside a built service',
      path: BUILT,
      text: STALE_BESIDE,
      errors: [
        at(
          STALE_BESIDE,
          '1.2.2',
          "Service 'alpha' serves @hyperfrontend/features@1.2.2 but demo-alpha installs 1.2.3 from the registry; the pin must be the published version the demo was built with."
        ),
      ],
      output: STARTED,
    },
    {
      name: 'an output path holding the quote of the start command',
      path: QUOTED,
      text: service('obrien', 'node main.cjs'),
      errors: [at(service('obrien', 'node main.cjs'), "'node main.cjs'", mustStart('obrien', QUOTED_MAIN))],
      output: service('obrien', `node "dist/apps/o\\'brien/main.cjs"`),
    },
    {
      name: 'a start command that leaves the token of the output path unreplaced',
      path: TOKEN,
      text: UNRESOLVED,
      errors: [at(UNRESOLVED, "'node out/{projectRoot}/main.cjs'", mustStart('token', TOKEN_MAIN))],
      output: service('token', TOKEN_MAIN),
    },
    {
      name: 'a start command that misses the output path a default of the executor gives',
      path: KEYED,
      text: UNDEFAULTED,
      errors: [at(UNDEFAULTED, "'node dist/apps/keyed/main.cjs'", mustStart('keyed', KEYED_MAIN))],
      output: service('keyed', KEYED_MAIN),
    },
    {
      name: 'a wrong start command for a build whose executor a default gives',
      path: NAMED,
      text: UNNAMED,
      errors: [at(UNNAMED, "'npx serve'", mustStart('named', NAMED_MAIN))],
      output: service('named', NAMED_MAIN),
    },
    {
      name: 'a start command that doubles the slash an output path ends in',
      path: SLASHED,
      text: DOUBLED,
      errors: [at(DOUBLED, "'node ./out/slashed//main.cjs'", mustStart('slashed', SLASHED_MAIN))],
      output: service('slashed', SLASHED_MAIN),
    },
    {
      name: 'a project whose only service target is not named build',
      path: MISNAMED,
      text: MISNAMED_MAIN,
      errors: [
        at(
          MISNAMED_MAIN,
          "'misnamed'",
          "Service 'misnamed' deploys app-misnamed as a built service, but app-misnamed has no build target that runs @hyperfrontend/workspace:service."
        ),
      ],
    },
    {
      name: 'a start command for the output of a service target before the build',
      path: SECOND,
      text: OTHER_TARGET,
      errors: [at(OTHER_TARGET, "'node out/bundle/main.cjs'", mustStart('second', SECOND_MAIN))],
      output: service('second', SECOND_MAIN),
    },
    {
      name: 'a built service whose last start command is not the main',
      path: BUILT,
      text: LAST_WRONG,
      errors: [at(LAST_WRONG, "'npx serve'", mustStart('hello', MAIN))],
      output: hello(`{ start: '${MAIN}', start: '${MAIN}' }`),
    },
    {
      name: 'a built service with a spread after its start command',
      path: BUILT,
      text: SPREAD_LAST,
      errors: [at(SPREAD_LAST, '...base', mustStart('hello', MAIN))],
    },
    {
      name: 'a built service with spreads on both sides of its start command',
      path: BUILT,
      text: SPREAD_BETWEEN,
      errors: [at(SPREAD_BETWEEN, '...late', mustStart('hello', MAIN))],
    },
    {
      name: 'a built service with a spread and no start command',
      path: BUILT,
      text: SPREAD_ALONE,
      errors: [at(SPREAD_ALONE, '...base', mustStart('hello', MAIN))],
    },
    {
      name: 'a built service whose quoted start key holds another command',
      path: BUILT,
      text: KEY_QUOTED_WRONG,
      errors: [at(KEY_QUOTED_WRONG, `'npx ${MAIN}'`, mustStart('hello', MAIN))],
      output: hello(`{ 'build': {}, "start": '${MAIN}' }`),
    },
    {
      name: 'a built service whose start key is computed from a variable',
      path: BUILT,
      text: KEY_COMPUTED,
      errors: [at(KEY_COMPUTED, `[start]: '${MAIN}'`, mustStart('hello', MAIN))],
    },
    {
      name: 'a built service with a computed key after its start command',
      path: BUILT,
      text: KEY_COMPUTED_LAST,
      errors: [at(KEY_COMPUTED_LAST, "[key]: 'npx serve'", mustStart('hello', MAIN))],
    },
    {
      name: 'a built service with a template key after its start command',
      path: BUILT,
      text: KEY_TEMPLATE_LAST,
      errors: [at(KEY_TEMPLATE_LAST, "[`start`]: 'npx serve'", mustStart('hello', MAIN))],
    },
    {
      name: 'a built service whose main is not quoted for the space in its path',
      path: SPACED,
      text: UNQUOTED,
      errors: [at(UNQUOTED, "'node dist/apps/my app/main.cjs'", mustStart('spaced', SPACED_MAIN))],
      output: service('spaced', SPACED_MAIN),
    },
    {
      name: 'a project without a name deployed as a built service',
      path: NAMELESS,
      text: NAMELESS_MAIN,
      errors: [
        at(
          NAMELESS_MAIN,
          "'nameless'",
          "Service 'nameless' deploys the project at apps/nameless as a built service, but the project at apps/nameless has no build target that runs @hyperfrontend/workspace:service."
        ),
      ],
    },
    {
      name: 'a project without a name whose service the file does not declare',
      path: NAMELESS,
      text: 'export default 1',
      errors: [
        at(
          'export default 1',
          'export default 1',
          "The project at apps/nameless deploys to Railway service 'nameless', which .railway/railway.ts does not declare."
        ),
      ],
    },
    {
      name: 'a pin behind the release a project without a name installs',
      path: ANONYMOUS,
      text: ANONYMOUS_STALE,
      errors: [
        at(
          ANONYMOUS_STALE,
          '1.2.2',
          "Service 'anonymous' serves @hyperfrontend/features@1.2.2 but the project at apps/anonymous installs 1.2.3 from the registry; the pin must be the published version the demo was built with."
        ),
      ],
      output: service('anonymous', serve('1.2.3')),
    },
    {
      name: 'a pin with a computed key after its start command',
      path: CLEAN,
      text: PIN_KEY_LAST,
      errors: [at(PIN_KEY_LAST, "[key]: 'npx serve'", mustPin('alpha'))],
    },
    {
      name: 'a pin under a computed key alone',
      path: CLEAN,
      text: PIN_KEY_ALONE,
      errors: [at(PIN_KEY_ALONE, `{ [key]: '${serve('1.2.3')}' }`, mustPin('alpha'))],
    },
    {
      name: 'a built service whose start command asserted const is not the main',
      path: BUILT,
      text: AS_CONST_WRONG,
      errors: [at(AS_CONST_WRONG, `'npx ${MAIN}'`, mustStart('hello', MAIN))],
      output: AS_CONST,
    },
    {
      name: 'a built service whose start command is a template asserted const',
      path: BUILT,
      text: WRAPPED_TEMPLATE,
      errors: [at(WRAPPED_TEMPLATE, `\`${MAIN}\``, mustStart('hello', MAIN))],
    },
    {
      name: 'a pin behind the release, read from the last start command',
      path: CLEAN,
      text: PIN_STALE_LAST,
      errors: [
        at(
          PIN_STALE_LAST,
          '1.2.2',
          "Service 'alpha' serves @hyperfrontend/features@1.2.2 but demo-alpha installs 1.2.3 from the registry; the pin must be the published version the demo was built with."
        ),
      ],
      output: `service('alpha', { start: '${serve('1.2.3')}', start: '${serve('1.2.3')}' as const })`,
    },
    {
      name: 'a pin with a spread after its start command',
      path: CLEAN,
      text: PIN_SPREAD_LAST,
      errors: [at(PIN_SPREAD_LAST, '...base', mustPin('alpha'))],
    },
    {
      name: 'a start command in double quotes',
      path: QUOTED,
      text: `service('obrien', { start: "node main.cjs" })`,
      errors: [at(`service('obrien', { start: "node main.cjs" })`, '"node main.cjs"', mustStart('obrien', QUOTED_MAIN))],
      output: `service('obrien', { start: "node \\"dist/apps/o'brien/main.cjs\\"" })`,
    },
  ],
})

describe('the disposable workspaces', () => {
  it('are removed once the cases have run', () => {
    workspaces.remove()
    expect(existsSync(workspaces.root)).toBe(false)
  })
})
