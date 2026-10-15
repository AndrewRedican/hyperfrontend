/**
 * Key under which the module generation lives on `globalThis`.
 *
 * The counter has to be reachable from both the resolution hooks and the `jest` API
 * without either importing the other, because importing the hook module would register
 * the hooks a second time. A registered symbol on the global object is the one channel
 * both sides can reach with no import edge between them.
 */
const GENERATION_KEY = Symbol.for('hyperfrontend.testing.moduleGeneration')

/**
 * Reads the current module generation.
 *
 * @returns The generation, or zero when none has been set.
 * @example Reading the generation a URL should carry
 * ```ts
 * currentGeneration() // => 0 before any reset
 * advanceGeneration()
 * currentGeneration() // => 1
 * ```
 */
export function currentGeneration(): number {
  const value = (globalThis as Record<symbol, unknown>)[GENERATION_KEY]
  return typeof value === 'number' ? value : 0
}

/**
 * Advances the module generation so later dynamic imports re-evaluate their target.
 *
 * Node's ES module registry has no eviction API. Resolving to a URL carrying a new query
 * is the only way to make a module body run again, which is what `jest.resetModules`
 * promises.
 *
 * @returns The generation now in effect.
 * @example Forcing the next import to evaluate a module again
 * ```ts
 * const generation = advanceGeneration() // => 1 on the first call
 * toModuleUrl('/repo/src/dep.ts') // => 'file:///repo/src/dep.ts?__hfGeneration=1', a URL Node has never loaded
 * ```
 */
export function advanceGeneration(): number {
  const next = currentGeneration() + 1
  ;(globalThis as Record<symbol, unknown>)[GENERATION_KEY] = next
  return next
}
