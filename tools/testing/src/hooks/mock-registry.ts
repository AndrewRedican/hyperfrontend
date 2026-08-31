import type { MockDeclaration } from './mock-declarations.ts'
import { createRequire } from 'node:module'
import { readMockDeclarations } from './mock-declarations.ts'

/**
 * Scheme the replacement module is served under. It has to be a URL of its own rather than
 * the mocked module's: a built-in the loader has already imported would never reach the
 * load hook again, so the substitution has to happen while the specifier is being resolved.
 */
export const MOCK_SCHEME = 'hf-mock:'

/**
 * Where captured namespaces live, so a replacement can reach the module it stands in for
 * without importing it under a second URL. A second URL would give the same source file two
 * coverage records, and the one the thresholds are checked against would be the wrong one.
 */
const ACTUALS = Symbol.for('hyperfrontend.testing.actuals')

/**
 * A registered replacement.
 */
type Registration = {
  /** The declaration as written in the spec. */
  declaration: MockDeclaration
  /** Export names to pass through untouched. */
  passthrough: string[]
  /** Whether the module it stands in for has a default export. */
  hasDefault: boolean
}

const registrations = new Map<string, Registration>()

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
 */
export function registerSpecMocks(specUrl: string, source: string): void {
  const require = createRequire(specUrl)

  for (const declaration of readMockDeclarations(source)) {
    let actual: Record<string, unknown>
    let target: string
    try {
      // how: resolving and loading before the registration below means this reaches the real module rather than the replacement.
      target = declaration.specifier.startsWith('node:') ? declaration.specifier : resolvedUrl(require, declaration.specifier)
      actual = require(declaration.specifier) as Record<string, unknown>
    } catch {
      // why: a specifier that resolves nowhere is the spec's problem to report, not the loader's to guess at.
      continue
    }

    store().set(target, actual)
    registrations.set(target, {
      declaration,
      passthrough: Object.keys(actual).filter(
        (key) => key !== 'default' && /^[A-Za-z_$][\w$]*$/.test(key) && !declaration.overrides.includes(key)
      ),
      hasDefault: 'default' in actual && !declaration.overrides.includes('default'),
    })
  }
}

/**
 * The map replacement modules read their captured namespace from.
 *
 * @returns The map, created on first use.
 */
function store(): Map<string, unknown> {
  return ((globalThis as Record<symbol, unknown>)[ACTUALS] ??= new Map<string, unknown>()) as Map<string, unknown>
}

/**
 * Resolves a specifier to the URL the loader will ask for.
 *
 * @param require - A require function bound to the spec declaring the mock.
 * @param specifier - The specifier as written.
 * @returns The resolved file URL.
 */
function resolvedUrl(require: NodeJS.Require, specifier: string): string {
  return new URL(`file://${require.resolve(specifier)}`).href
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
  const { declaration, passthrough, hasDefault } = registration

  const lines: string[] = [
    `import { jest as __hfJest } from ${JSON.stringify(runtimeUrl)}`,
    `const __hfActual = globalThis[Symbol.for(${JSON.stringify(ACTUALS.description)})].get(${JSON.stringify(url)})`,
    `const jest = { ...__hfJest, requireActual: () => __hfActual }`,
  ]

  if (!declaration.factory) {
    // why: the automock form replaces every export with a fresh mock function, which is what Jest does when no factory is given.
    for (const name of passthrough) lines.push(`export const ${name} = jest.fn()`)
    if (hasDefault) lines.push(`export default jest.fn()`)
    return lines.join('\n')
  }

  lines.push(`const __hfNs = (${declaration.factory})()`)
  for (const name of declaration.overrides) lines.push(`export const ${name} = __hfNs[${JSON.stringify(name)}]`)
  // why: an import of a name the factory did not define is a link error rather than the undefined Jest would hand back, so every other export has to stay reachable.
  for (const name of passthrough) lines.push(`export const ${name} = __hfActual[${JSON.stringify(name)}]`)
  if (hasDefault) lines.push(`export default __hfActual["default"]`)

  return lines.join('\n')
}

/**
 * Forgets every registration. Used by the runtime's own suites.
 */
export function clearRegistrations(): void {
  registrations.clear()
  store().clear()
}
