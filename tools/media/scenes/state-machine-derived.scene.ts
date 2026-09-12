import type { FlagValue } from '../src/models/derived'
import { derivedStage } from '../src/derived/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('state-machine')

/**
 * A flag read or written as true.
 *
 * @param flag - The flag's name.
 * @returns The flag paired with `true`.
 */
function on(flag: string): FlagValue {
  return { flag, value: true }
}

/**
 * A flag read or written as false.
 *
 * @param flag - The flag's name.
 * @returns The flag paired with `false`.
 */
function off(flag: string): FlagValue {
  return { flag, value: false }
}

/**
 * The same `start()` three times, landing on a different name each time.
 *
 * The store is four booleans and the selectors are names computed from them,
 * so the frame is exactly that: four lamps on the left, seven names on the
 * right, and a wire from each lamp to every name that reads it. The five
 * actions on the rail fire in turn, each dropping a token onto the lamp it
 * lights. What makes the scene is the reducer's `START` handler, which sets
 * `inProgress` and leaves `success` and `fail` as they were: the second
 * `start()` lands while the `fail` lamp is still on and lights `retrying`, the
 * third lands while `success` is still on and lights `restarting`. `FAIL` and
 * `SUCCESS` clear one another, which is why the two never stack. `halt` is
 * drawn and never touched, because none of the seven names read it.
 *
 * Every lamp, name and write below is the package's own, verified on
 * 2026-09-12 against `libs/state-machine/src/state/state.ts` (the initial
 * state is four falses), `libs/state-machine/src/reducer/reducer.ts` (`START`
 * spreads the state and sets `inProgress` alone; `FAIL` and `SUCCESS` each
 * clear `inProgress`, the other flag and `halt`) and
 * `libs/state-machine/src/selectors/selectors.ts` (each name's reads, `done`
 * being the one with an `or`).
 */
export default defineScriptedScene({
  slug: 'state-machine-derived',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: derivedStage,
  holdMs: 1_800,
  gif: { colours: 56, lossy: 60, maxBytes: 800_000 },
  stills: [{ name: 'poster', atMs: 11_900, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    mark: identity.mark,
    api: 'derivedState',
    railLabel: 'dispatch',
    restMs: 1_000,
    lamps: [
      { flag: 'inProgress', tone: 'accent' },
      { flag: 'success', tone: 'success' },
      { flag: 'fail', tone: 'danger' },
      { flag: 'halt', tone: 'warning' },
    ],
    names: [
      { name: 'notStarted', all: [off('inProgress'), off('success'), off('fail')] },
      { name: 'inProgress', all: [on('inProgress')] },
      { name: 'done', all: [off('inProgress')], any: [on('success'), on('fail')] },
      { name: 'successful', all: [off('inProgress'), on('success'), off('fail')] },
      { name: 'failed', all: [off('inProgress'), off('success'), on('fail')] },
      { name: 'retrying', all: [on('inProgress'), off('success'), on('fail')] },
      { name: 'restarting', all: [on('inProgress'), on('success'), off('fail')] },
    ],
    actions: [
      { name: 'start()', atMs: 1_400, writes: [on('inProgress')] },
      { name: 'fail()', atMs: 3_600, writes: [off('inProgress'), off('success'), on('fail'), off('halt')] },
      { name: 'start()', atMs: 5_800, writes: [on('inProgress')] },
      { name: 'success()', atMs: 8_000, writes: [off('inProgress'), on('success'), off('fail'), off('halt')] },
      { name: 'start()', atMs: 10_200, writes: [on('inProgress')] },
    ],
  },
})
