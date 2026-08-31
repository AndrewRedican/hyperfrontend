import type { MockDeclaration } from './mock-declarations.ts'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readMockDeclarations } from './mock-declarations.ts'

/**
 * Query appended to a specifier to reach the module a mock is standing in for. The loader
 * strips it and loads the real thing, so the actual and its replacement are separate
 * modules rather than one recursive one.
 */
export const ACTUAL_QUERY = '__hf_actual'

/**
 * Scheme the replacement module is served under. It has to be a URL of its own rather than
 * the mocked module's: a built-in the loader has already imported would never reach the
 * load hook again, so the substitution has to happen while the specifier is being resolved.
 */
export const MOCK_SCHEME = 'hf-mock:'

/**
 * Where captured built-in namespaces live. A built-in cannot carry a query, so its actual
 * has to be taken with `require` before the hooks are in a position to intercept it, and
 * handed to the replacement through a global.
 */
const ACTUALS = Symbol.for('hyperfrontend.testing.actuals')

/**
 * A registered replacement.
 */
type Registration = {
  /** The declaration as written in the spec. */
  declaration: MockDeclaration
  /** True when the target is a Node built-in rather than a file. */
  builtin: boolean
  /** Export names to pass through untouched, for built-ins only. */
  passthrough: string[]
}

const registrations = new Map<string, Registration>()

/**
 * Reads a built-in's namespace, caching it where a replacement module can reach it.
 *
 * @param identifier - The built-in's specifier, such as `node:child_process`.
 * @returns The built-in's exports.
 */
function captureBuiltin(identifier: string): Record<string, unknown> {
  const store = ((globalThis as Record<symbol, unknown>)[ACTUALS] ??= new Map<string, unknown>()) as Map<string, unknown>
  const existing = store.get(identifier)
  if (existing) return existing as Record<string, unknown>
  const captured = createRequire(import.meta.url)(identifier) as Record<string, unknown>
  store.set(identifier, captured)
  return captured
}

/**
 * Registers every `jest.mock` a spec declares.
 *
 * Jest hoists `jest.mock` above the `require` calls a spec compiles down to. ES modules
 * have no equivalent, since imports are linked before any statement runs. What happens
 * instead is that the declarations are read out of the spec's source while its `load` hook
 * is running, which Node calls before it resolves the spec's imports.
 *
 * @param specUrl - URL of the spec file being loaded.
 * @param source - The spec file's text.
 * @param resolveSpecifier - Resolves a specifier the way the rest of the hooks would.
 */
export function registerSpecMocks(
  specUrl: string,
  source: string,
  resolveSpecifier: (specifier: string, parent: string) => string | undefined
): void {
  for (const declaration of readMockDeclarations(source)) {
    const target = resolveTarget(declaration.specifier, specUrl, resolveSpecifier)
    if (!target) continue

    const builtin = target.startsWith('node:')
    const actual = builtin ? captureBuiltin(target) : undefined
    const passthrough = actual ? exportableKeys(actual, declaration) : []
    registrations.set(target, { declaration, builtin, passthrough })
  }
}

/**
 * Names a built-in replacement should re-export unchanged.
 *
 * @param actual - The built-in's namespace.
 * @param declaration - The declaration being registered.
 * @returns The names to pass through.
 */
function exportableKeys(actual: Record<string, unknown>, declaration: MockDeclaration): string[] {
  // why: without a factory every export is replaced, and with one only a spread asks for the rest to survive.
  if (declaration.factory && !declaration.spreads) return []
  return Object.keys(actual).filter((key) => /^[A-Za-z_$][\w$]*$/.test(key) && !declaration.overrides.includes(key))
}

/**
 * Resolves a mocked specifier to the identifier the loader will ask for.
 *
 * @param specifier - The specifier as written in the spec.
 * @param specUrl - URL of the spec declaring it.
 * @param resolveSpecifier - Resolves a specifier the way the rest of the hooks would.
 * @returns A file URL or built-in identifier, or undefined when it cannot be resolved.
 */
function resolveTarget(
  specifier: string,
  specUrl: string,
  resolveSpecifier: (specifier: string, parent: string) => string | undefined
): string | undefined {
  if (specifier.startsWith('node:')) return specifier

  const viaHooks = resolveSpecifier(specifier, specUrl)
  if (viaHooks) return viaHooks

  try {
    return pathToFileURL(createRequire(specUrl).resolve(specifier)).href
  } catch {
    // why: a specifier that resolves nowhere is the spec's problem to report, not the loader's to guess at.
    return undefined
  }
}

/**
 * Reports whether a URL has a replacement registered.
 *
 * @param url - The URL the loader is about to load.
 * @returns True when a replacement should be substituted.
 */
export function isMocked(url: string): boolean {
  return registrations.has(url)
}

/**
 * Builds the source of the module that stands in for a mocked one.
 *
 * @param url - The mocked module's URL or built-in identifier.
 * @param runtimeUrl - URL of the module exporting the runtime's `jest` object.
 * @returns The replacement module's source.
 */
export function mockedSource(url: string, runtimeUrl: string): string {
  const registration = registrations.get(url)
  if (!registration) throw new Error(`no mock registered for ${url}`)
  const { declaration, builtin, passthrough } = registration

  const lines: string[] = [`import { jest as __hfJest } from ${JSON.stringify(runtimeUrl)}`]

  if (builtin) {
    lines.push(`const __hfActual = globalThis[Symbol.for(${JSON.stringify(ACTUALS.description)})].get(${JSON.stringify(url)})`)
  } else {
    const actualUrl = `${url}${url.includes('?') ? '&' : '?'}${ACTUAL_QUERY}`
    lines.push(`import * as __hfActual from ${JSON.stringify(actualUrl)}`)
    // why: a spread in the factory asks for every export it did not name to survive, and an explicit export below wins over a star.
    if (declaration.spreads) lines.push(`export * from ${JSON.stringify(actualUrl)}`)
  }

  lines.push(`const jest = { ...__hfJest, requireActual: () => __hfActual }`)

  if (declaration.factory) {
    lines.push(`const __hfNs = (${declaration.factory})()`)
    for (const name of declaration.overrides) lines.push(`export const ${name} = __hfNs[${JSON.stringify(name)}]`)
  } else {
    // why: the automock form replaces every export with a fresh mock function, which is what Jest does when no factory is given.
    for (const name of passthrough) lines.push(`export const ${name} = jest.fn()`)
    return lines.join('\n')
  }

  for (const name of passthrough) lines.push(`export const ${name} = __hfActual[${JSON.stringify(name)}]`)

  return lines.join('\n')
}

/**
 * Forgets every registration. Used by the runtime's own suites.
 */
export function clearRegistrations(): void {
  registrations.clear()
}
