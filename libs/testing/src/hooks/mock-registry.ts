import type { MockDeclaration } from './mock-declarations.ts'
import { createRequire } from 'node:module'
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readMockDeclarations, readUnmockDeclarations } from './mock-declarations.ts'

/**
 * Scheme the replacement module is served under. It has to be a URL of its own rather than
 * the mocked module's: a built-in the loader has already imported would never reach the
 * load hook again, so the substitution has to happen while the specifier is being resolved.
 */
export const MOCK_SCHEME = 'hf-mock:'

/**
 * Prefix for the local a replacement binds an override to before exporting it under the
 * real name. The override names come from an object literal's keys, so they are already
 * legal identifiers and stay legal with this in front.
 */
const LOCAL_PREFIX = '__hfExport$'

/**
 * Reads back the URL a replacement stands in for.
 *
 * The mocked URL is carried in the replacement's own URL, encoded so that a path, a query,
 * or a built-in identifier all survive being nested inside one.
 *
 * @param url - A replacement's URL.
 * @returns The URL of the module it replaces.
 * @example Reading the mocked module back out of a replacement's URL
 * ```ts
 * mockTarget('hf-mock:node%3Apath?g=2') // => 'node:path'
 * mockTarget('hf-mock:file%3A%2F%2F%2Fproject%2Fsrc%2Fdep.ts?g=0') // => 'file:///project/src/dep.ts'
 * ```
 */
export function mockTarget(url: string): string {
  return decodeURIComponent(url.slice(MOCK_SCHEME.length).split('?g=')[0] ?? '')
}

/**
 * Reports whether a resolution is a replacement reaching the module it stands in for,
 * rather than code under test asking for that module.
 *
 * A replacement imports the real module by URL, so its own imports name it as the importer.
 * A CommonJS module is not imported but required, and Node resolves it a second time by its
 * own filename while evaluating it for the replacement that asked for it. That second
 * resolution carries no importer at all, and substituting the replacement for it would make
 * the replacement import itself: a require cycle, reported against the real module.
 *
 * @param specifier - The specifier as written.
 * @param parentUrl - URL of the importing module, absent when Node re-resolves a module it has already resolved.
 * @returns True when the substitution must be left off.
 * @example Telling a replacement's own import from a spec's
 * ```ts
 * isReplacementRequest('file:///project/src/dep.ts', 'hf-mock:file%3A%2F%2F%2Fproject%2Fsrc%2Fdep.ts?g=0') // => true
 * isReplacementRequest('/project/src/dep.ts', undefined) // => true, Node re-resolving a required module by its filename
 * isReplacementRequest('./dep', 'file:///project/src/dep.spec.ts') // => false, the spec's import may be substituted
 * ```
 */
export function isReplacementRequest(specifier: string, parentUrl: string | undefined): boolean {
  if (parentUrl === undefined) return isAbsolute(specifier)
  return parentUrl.startsWith(MOCK_SCHEME)
}

/**
 * Resolves a specifier the way the loader's own resolution hook does.
 */
type SpecifierResolver = (specifier: string, parentUrl: string) => string | null

/**
 * Key under which the loader's resolution lives on `globalThis`.
 *
 * The hooks entry installs it and the runtime `jest` object consults it, and a build may
 * give each entry its own copy of this module. Kept where every copy finds the same one,
 * like the registrations, the module generation and the mock context: a copy without it
 * would fall back to `require.resolve`, which drops the generation query, and a replacement
 * declared with `jest.doMock` after `jest.resetModules` would register under a URL the
 * resolve hook never asks for.
 */
const RESOLVER_KEY = Symbol.for('hyperfrontend.testing.specifierResolver')

/**
 * Reads the loader's resolution, if the hooks have installed one.
 *
 * @returns The resolver, or undefined before the hooks are registered.
 */
function workspaceResolver(): SpecifierResolver | undefined {
  return (globalThis as Record<symbol, unknown>)[RESOLVER_KEY] as SpecifierResolver | undefined
}

/**
 * Hands the registry the loader's resolution, so both agree on which URL a specifier names.
 *
 * Without it the registry falls back to `require.resolve`, which knows nothing of the
 * workspace's TypeScript path aliases: a `jest.mock` naming another library in the
 * workspace would resolve nowhere and register nothing, silently leaving the real module in
 * place.
 *
 * @param resolver - The loader's resolution, already bound to its context.
 * @example Sharing the loader's resolution with the registry
 * ```ts
 * setSpecifierResolver((specifier, parentUrl) => resolveSpecifier(specifier, parentUrl, context))
 * ```
 */
export function setSpecifierResolver(resolver: SpecifierResolver): void {
  ;(globalThis as Record<symbol, unknown>)[RESOLVER_KEY] = resolver
}

/**
 * Resolves a specifier to the module it names, ignoring any replacement standing in for it.
 *
 * The loader's own resolution is tried first, because it is the one that knows the
 * workspace's aliases and extensionless TypeScript specifiers, and it never returns a
 * replacement's URL.
 *
 * `require.resolve` covers what is left, and it runs through the same hooks an import does,
 * so a specifier that already has a replacement resolves to the replacement's URL rather
 * than to a path. Reading the mocked URL back out of it is what keeps registration and
 * `jest.requireActual` agreeing on one key, and what stops `jest.requireActual` from handing
 * back the very mock it is meant to see past.
 *
 * @param require - A require function bound to the file the specifier was written in.
 * @param specifier - The specifier as written.
 * @param parentUrl - URL of the file the specifier was written in, for the loader's resolution.
 * @returns The URL of the module named, or the built-in's identifier.
 * @example Finding the key a specifier registers under
 * ```ts
 * const require = createRequire('file:///project/src/subject.spec.ts')
 * resolveActualUrl(require, './dep', 'file:///project/src/subject.spec.ts') // => 'file:///project/src/dep.ts', even once './dep' resolves to its replacement
 * resolveActualUrl(require, 'node:path') // => 'node:path'
 * ```
 */
export function resolveActualUrl(require: NodeJS.Require, specifier: string, parentUrl?: string): string {
  if (specifier.startsWith('node:')) return specifier

  const workspace = parentUrl ? workspaceResolver()?.(specifier, parentUrl) : null
  if (workspace) return workspace

  const resolved = require.resolve(specifier)
  if (resolved.startsWith(MOCK_SCHEME)) return mockTarget(resolved)
  return pathToFileURL(resolved).href
}

/**
 * A registered replacement.
 */
type Registration = {
  /** The declaration as written in the spec. */
  declaration: MockDeclaration
  /** Export names to replace with a fresh mock, for the automock form only. */
  automocked: string[]
}

/**
 * Where a replacement publishes the namespace of the module it stands in for, and where the
 * URL of the spec under test is recorded. `jest.requireActual` and `jest.doMock` are called
 * from a spec body with a specifier relative to that spec, and neither has any other way to
 * know what it is relative to.
 */
const CONTEXT = Symbol.for('hyperfrontend.testing.mockContext')

/**
 * What a spec's replacements publish for the runtime `jest` object to read.
 */
export type MockContext = {
  /** URL of the spec being run. */
  specUrl: string
  /** Namespace of each replaced module, keyed by its URL. */
  actuals: Map<string, unknown>
  /** What each replacement's factory produced, keyed by the replaced module's URL. */
  mocks: Map<string, unknown>
}

/**
 * Key under which the registrations live on `globalThis`.
 *
 * The resolve hook reads the registry and the runtime `jest` object writes to it, and the
 * two reach this module through different entries of the package. A build is free to give
 * each entry its own copy of the module, so the map is kept where every copy finds the same
 * one, the way the module generation and the mock context already are.
 */
const REGISTRY_KEY = Symbol.for('hyperfrontend.testing.mockRegistrations')

/**
 * Reads the registry, creating it on first use.
 *
 * @returns Every registered replacement, keyed by the URL it stands in for.
 */
function registrations(): Map<string, Registration> {
  return ((globalThis as Record<symbol, unknown>)[REGISTRY_KEY] ??= new Map<string, Registration>()) as Map<string, Registration>
}

/**
 * Reads the shared context, creating it on first use.
 *
 * @returns The context object.
 * @example Reading what the replacements published
 * ```ts
 * const context = mockContext()
 * context.specUrl // => 'file:///project/src/subject.spec.ts', the spec whose declarations the loader read
 * context.actuals.get('file:///project/src/dep.ts') // => the real module's namespace, once its replacement has loaded
 * ```
 */
export function mockContext(): MockContext {
  return ((globalThis as Record<symbol, unknown>)[CONTEXT] ??= {
    specUrl: '',
    actuals: new Map<string, unknown>(),
    mocks: new Map<string, unknown>(),
  }) as MockContext
}

/**
 * Registers a replacement declared while the suite is running, rather than read out of the
 * spec's source before it loaded.
 *
 * It only takes effect for modules imported after it, which is why the suites that use it
 * pair it with `jest.resetModules` and a dynamic import.
 *
 * @param specifier - The specifier as written.
 * @param factory - The factory producing the replacement's exports.
 * @example Backing `jest.doMock`
 * ```ts
 * advanceGeneration()
 * registerRuntimeMock('./dep', () => ({ read: () => 'replaced' }))
 * const { read } = await import('./dep')
 * read() // => 'replaced'
 * ```
 */
export function registerRuntimeMock(specifier: string, factory: () => unknown): void {
  const source = `jest.mock(${JSON.stringify(specifier)}, ${String(factory)})`
  registerSpecMocks(mockContext().specUrl, source)
}

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
 * @example Registering a spec's declarations as its load hook runs
 * ```ts
 * registerSpecMocks('file:///project/src/subject.spec.ts', "jest.mock('./dep', () => ({ read: () => 1 }))")
 * isMocked('file:///project/src/dep.ts') // => true
 * ```
 */
export function registerSpecMocks(specUrl: string, source: string): void {
  if (!mockContext().specUrl) mockContext().specUrl = specUrl
  registerDeclarations(specUrl, source)
}

/**
 * Registers every `jest.mock` a project's setup module declares.
 *
 * This is what a Jest `setupFilesAfterEnv` module did for a whole project. The module is
 * preloaded ahead of every spec, so its declarations are in the registry before any spec
 * resolves an import, and they apply to all of them. A spec declaring its own replacement
 * for the same module is read later and wins.
 *
 * The context's spec URL is deliberately not claimed here: `jest.requireActual` and
 * `jest.doMock` called from a spec body resolve their specifier relative to it, and a
 * setup module that took the slot would make every relative specifier resolve against the
 * wrong file.
 *
 * @param setupUrl - URL of the setup module being loaded.
 * @param source - The setup module's text.
 * @example Registering a project-wide replacement from a setup module
 * ```ts
 * registerSetupMocks('file:///project/test.setup.ts', "jest.mock('./src/dep', () => ({ read: () => 1 }))")
 * isMocked('file:///project/src/dep.ts') // => true, for every spec the environment runs
 * ```
 */
export function registerSetupMocks(setupUrl: string, source: string): void {
  registerDeclarations(setupUrl, source)
}

/**
 * Reads the declarations out of one file's source and records them.
 *
 * @param sourceUrl - URL of the file the declarations were written in.
 * @param source - That file's text.
 */
function registerDeclarations(sourceUrl: string, source: string): void {
  const require = createRequire(sourceUrl)

  for (const declaration of readMockDeclarations(source)) {
    let target: string
    try {
      target = resolveActualUrl(require, declaration.specifier, sourceUrl)
    } catch {
      // why: a specifier that resolves nowhere is the spec's problem to report, not the loader's to guess at.
      continue
    }

    registrations().set(target, {
      declaration,
      automocked: declaration.factory ? [] : automockedNames(require, declaration.specifier, target),
    })
  }

  // why: a spec opts out of a replacement its setup module declared for the whole project, so the removal has to run after the registrations rather than beside them.
  for (const specifier of readUnmockDeclarations(source)) {
    try {
      registrations().delete(resolveActualUrl(require, specifier, sourceUrl))
    } catch {
      // why: a specifier that resolves nowhere has no registration to remove either.
      continue
    }
  }
}

/**
 * Reads the export names an automocked module defines.
 *
 * This is the one case that has to load the module: without a factory there is nothing to
 * generate exports from. An automocked built-in pulls in no project code; an automocked
 * project module is evaluated once, here, to learn its names.
 *
 * @param require - A require function bound to the spec declaring the mock.
 * @param specifier - The specifier as written.
 * @param target - URL of the module being replaced.
 * @returns The names to replace with mock functions.
 */
function automockedNames(require: NodeJS.Require, specifier: string, target: string): string[] {
  const actual = require(specifier) as Record<string, unknown>
  // why: this form generates its exports rather than importing the module, so publishing here is the only chance `jest.requireActual` gets to see past it.
  mockContext().actuals.set(target, actual)
  return Object.keys(actual).filter((key) => /^[A-Za-z_$][\w$]*$/.test(key))
}

/**
 * Reports whether a URL has a replacement registered.
 *
 * @param url - The URL the loader is about to load.
 * @returns True when a replacement should be substituted.
 * @example Checking a resolved URL before loading it
 * ```ts
 * registerSpecMocks(specUrl, "jest.mock('node:path')")
 * isMocked('node:path') // => true
 * isMocked('node:fs') // => false
 * ```
 */
export function isMocked(url: string): boolean {
  return registrations().has(url)
}

/**
 * Builds the source of the module that stands in for a mocked one.
 *
 * @param url - The mocked module's URL or built-in identifier.
 * @param runtimeUrl - URL of the module exporting the runtime's `jest` object.
 * @returns The replacement module's source.
 * @example Generating the replacement for a factory with one override
 * ```ts
 * registerSpecMocks(specUrl, "jest.mock('./dep', () => ({ read: () => 1 }))")
 * mockedSource('file:///project/src/dep.ts', runtimeUrl)
 * // => the replacement's source, line by line:
 * //    import { jest as __hfJest } from "<runtimeUrl>"
 * //    import * as __hfActual from "file:///project/src/dep.ts"
 * //    ...
 * //    export * from "file:///project/src/dep.ts"
 * //    const __hfNs = (() => ({ read: () => 1 }))()
 * //    ...
 * //    export { __hfExport$read as read }
 * ```
 */
export function mockedSource(url: string, runtimeUrl: string): string {
  const registration = registrations().get(url)
  if (!registration) throw new Error(`no mock registered for ${url}`)
  const { declaration, automocked } = registration

  const lines: string[] = [`import { jest as __hfJest } from ${JSON.stringify(runtimeUrl)}`]

  if (!declaration.factory) {
    // why: the automock form replaces every export with a fresh mock function, which is what Jest does when no factory is given.
    for (const name of automocked) lines.push(`export const ${name} = __hfJest.fn()`)
    lines.push(publishes('mocks', url, `{ ${automocked.join(', ')} }`))
    return lines.join('\n')
  }

  lines.push(`import * as __hfActual from ${JSON.stringify(url)}`)
  // why: `jest.requireActual` is called from the spec body, long after this module linked, and this is where the real namespace is already in hand.
  lines.push(publishes('actuals', url, '__hfActual'))
  // why: an import of a name the factory did not define is a link error rather than the undefined Jest would hand back, so every other export has to stay reachable. An explicit export below wins over a star.
  lines.push(`export * from ${JSON.stringify(url)}`)
  lines.push(`const jest = { ...__hfJest, requireActual: () => __hfActual }`)
  lines.push(`const __hfNs = (${declaration.factory})()`)
  // why: `jest.requireMock` asks for what the factory produced, and this is the only place it exists as a value.
  lines.push(publishes('mocks', url, '__hfNs'))

  // why: the factory is carried through verbatim, and its body ran in the spec's scope where a bare `setInterval` meant the global. Exporting that name under a local of the same name would rebind it to the export, so a forwarding replacement would call itself until the stack ran out. Aliasing on the way out leaves the bare name resolving to the global, as it did.
  for (const name of declaration.overrides) {
    lines.push(`const ${LOCAL_PREFIX}${name} = __hfNs[${JSON.stringify(name)}]`)
    lines.push(`export { ${LOCAL_PREFIX}${name} as ${name} }`)
  }

  return lines.join('\n')
}

/**
 * Renders the statement a replacement uses to publish a namespace for the runtime to read.
 *
 * @param map - Which of the context's maps to write into.
 * @param url - The replaced module's URL, used as the key.
 * @param expression - Source of the value to publish.
 * @returns The statement.
 */
function publishes(map: 'actuals' | 'mocks', url: string, expression: string): string {
  return `globalThis[Symbol.for(${JSON.stringify(CONTEXT.description)})].${map}.set(${JSON.stringify(url)}, ${expression})`
}

/**
 * Forgets every registration. Used by the runtime's own suites.
 *
 * @example Isolating the registry between tests
 * ```ts
 * afterEach(() => clearRegistrations())
 * ```
 */
export function clearRegistrations(): void {
  registrations().clear()
}
