import type { MockDeclaration } from './mock-declarations.ts'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readMockDeclarations } from './mock-declarations.ts'

/**
 * Scheme the replacement module is served under. It has to be a URL of its own rather than
 * the mocked module's: a built-in the loader has already imported would never reach the
 * load hook again, so the substitution has to happen while the specifier is being resolved.
 */
export const MOCK_SCHEME = 'hf-mock:'

/**
 * A registered replacement.
 */
type Registration = {
  /** The declaration as written in the spec. */
  declaration: MockDeclaration
  /** Export names to replace with a fresh mock, for the automock form only. */
  automocked: string[]
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
 * Nothing is loaded here. Resolving a specifier is enough to know which URL to replace, and
 * loading the module would pull its consumers in early: a barrel that re-exports a module
 * mocked by a later declaration would bind the real one and keep it.
 *
 * @param specUrl - URL of the spec file being loaded.
 * @param source - The spec file's text.
 */
export function registerSpecMocks(specUrl: string, source: string): void {
  const require = createRequire(specUrl)

  for (const declaration of readMockDeclarations(source)) {
    let target: string
    try {
      target = declaration.specifier.startsWith('node:')
        ? declaration.specifier
        : pathToFileURL(require.resolve(declaration.specifier)).href
    } catch {
      // why: a specifier that resolves nowhere is the spec's problem to report, not the loader's to guess at.
      continue
    }

    registrations.set(target, { declaration, automocked: declaration.factory ? [] : automockedNames(require, declaration.specifier) })
  }
}

/**
 * Reads the export names an automocked module defines.
 *
 * This is the one case that has to load the module: without a factory there is nothing to
 * generate exports from. Every automock in this repository names a built-in, so loading it
 * pulls in no project code.
 *
 * @param require - A require function bound to the spec declaring the mock.
 * @param specifier - The specifier as written.
 * @returns The names to replace with mock functions.
 */
function automockedNames(require: NodeJS.Require, specifier: string): string[] {
  const actual = require(specifier) as Record<string, unknown>
  return Object.keys(actual).filter((key) => /^[A-Za-z_$][\w$]*$/.test(key))
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
  const { declaration, automocked } = registration

  const lines: string[] = [`import { jest as __hfJest } from ${JSON.stringify(runtimeUrl)}`]

  if (!declaration.factory) {
    // why: the automock form replaces every export with a fresh mock function, which is what Jest does when no factory is given.
    for (const name of automocked) lines.push(`export const ${name} = __hfJest.fn()`)
    return lines.join('\n')
  }

  lines.push(`import * as __hfActual from ${JSON.stringify(url)}`)
  // why: an import of a name the factory did not define is a link error rather than the undefined Jest would hand back, so every other export has to stay reachable. An explicit export below wins over a star.
  lines.push(`export * from ${JSON.stringify(url)}`)
  lines.push(`const jest = { ...__hfJest, requireActual: () => __hfActual }`)
  lines.push(`const __hfNs = (${declaration.factory})()`)
  for (const name of declaration.overrides) lines.push(`export const ${name} = __hfNs[${JSON.stringify(name)}]`)

  return lines.join('\n')
}

/**
 * Forgets every registration. Used by the runtime's own suites.
 */
export function clearRegistrations(): void {
  registrations.clear()
}
