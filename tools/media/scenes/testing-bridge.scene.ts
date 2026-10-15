import { bridgeStage } from '../src/bridge/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('testing')

/**
 * The spec you wrote for Jest, running on Node's own runner.
 *
 * The claim the package makes is that a spec written in Jest's idiom needs
 * no Jest to run: every call in it rests on something Node already ships,
 * and the package is the wiring between the two. So the frame is that spec
 * typing itself onto a sheet on the left, each line opening with the export
 * it calls, and the primitive each call rests on standing on the right as a
 * plain label that lights when the wire from the call reaches it. `describe`
 * and `it` both land on `node:test`, `expect` lands on `node:assert`, where
 * a failed matcher throws its `AssertionError`, `jest.mock` lands on
 * `module.registerHooks`, through which the preload serves the replacement,
 * and `jest.useFakeTimers` lands on `mock.timers`, the fake clock
 * `node:test` provides. The count beside `node:assert` is the assertions
 * wired so far. Once the last wire is in the verdict comes back along the
 * test's wire and the test gets its check; then the coverage figure the
 * runner prints after every run counts up along the bottom of the sheet,
 * headed as the table heads its columns, and the tick lands beside it.
 *
 * The spec and its figure are the scene's own: `cart.spec.ts`, its
 * assertions and its percentages are examples, chosen so that every idiom
 * shown is one the package serves. The mapping is what was verified, on
 * 2026-10-14, against `libs/testing/src/blocks/blocks.ts` (`describe` and
 * `it` call `node:test`'s `describe` and `it` with the body adapted),
 * `libs/testing/src/expect/expectation.ts` (a failed expectation throws
 * `node:assert`'s `AssertionError`), `libs/testing/src/hooks/index.ts` and
 * `libs/testing/src/hooks/mock-registry.ts` (the `jest.mock` declarations
 * are read out of the spec's source in the `load` hook, before Node resolves
 * the spec's imports, and the replacement is served through
 * `module.registerHooks`; the factory-less form replaces every export with
 * a mock function), `libs/testing/src/mock/timers.ts` (`jest.useFakeTimers`
 * enables `node:test`'s `mock.timers`), `libs/testing/src/runner/argv.ts`
 * (every run passes `--experimental-test-coverage`) and
 * `libs/testing/src/coverage/gate.ts` (the per-file table is headed
 * `line %`, `branch %` and `funcs %`, with each percentage printed to two
 * decimals). The four exports on the chips come from
 * `libs/testing/src/index.ts`; `runner` is the entry
 * `@hyperfrontend/testing/runner`, which prints the table.
 */
export default defineScriptedScene({
  slug: 'testing-bridge',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: bridgeStage,
  holdMs: 1_800,
  gif: { colours: 56, lossy: 45, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 9_800, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    mark: identity.mark,
    file: 'cart.spec.ts',
    typeAtMs: 300,
    typeCps: 34,
    lines: [
      { api: 'jest', text: ".mock('./api')", rests: 0 },
      { text: '' },
      { api: 'describe', text: "('cart', () => {", rests: 1 },
      { indent: 2, api: 'it', text: "('totals', () => {", rests: 1, verdict: true },
      { indent: 4, api: 'jest', text: '.useFakeTimers()', rests: 2 },
      { indent: 4, api: 'expect', text: '(total()).toBe(42)', rests: 3 },
      { indent: 4, api: 'expect', text: '(lines).toHaveLength(2)', rests: 3 },
      { indent: 2, text: '})' },
      { text: '})' },
    ],
    primitives: [{ name: 'module.registerHooks' }, { name: 'node:test' }, { name: 'mock.timers' }, { name: 'node:assert', tally: true }],
    report: {
      api: 'runner',
      figures: [
        { label: 'line %', value: 100 },
        { label: 'branch %', value: 95.65 },
        { label: 'funcs %', value: 100 },
      ],
    },
    restMs: 1_200,
  },
})
