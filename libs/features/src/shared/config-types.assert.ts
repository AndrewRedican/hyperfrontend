import { defineConfig } from './define-config'

// note: Compile-time probes for the isolation narrowing. They live outside a .spec file because `nx typecheck` reads tsconfig.lib.json, which excludes specs, and an `@ts-expect-error` nothing typechecks asserts nothing.
// note: Each directive below is itself the assertion: a combination that stops being rejected fails typecheck as an unused directive, and one that starts being rejected fails as a type error, so the narrowing cannot drift in either direction.
// note: No package entry imports this module, so it is typechecked but never bundled.

const IDENTITY = { name: 'probe', version: '1.0.0', contract: './probe.contract.json' }

/** Declaring no isolation leaves every display mode available. */
export const OPEN_ORIGIN = defineConfig({
  ...IDENTITY,
  display: { modes: ['embedded', 'dialog', 'popup', 'standalone'], popup: { width: 400 } },
})

/** A cross-origin isolated origin serves the framed modes. */
export const ISOLATED_FRAMED = defineConfig({
  ...IDENTITY,
  isolation: 'require-corp',
  display: { modes: ['embedded', 'dialog'] },
})

/** Isolation with no display block at all is a complete declaration. */
export const ISOLATED_UNDECLARED = defineConfig({ ...IDENTITY, isolation: 'credentialless' })

/** Declaring same-origin reach names the one pairing that keeps its opener, so the windowed modes return. */
export const ISOLATED_SAME_ORIGIN = defineConfig({
  ...IDENTITY,
  isolation: { coep: 'require-corp', hosts: 'same-origin' },
  display: { modes: ['embedded', 'popup', 'standalone'], popup: { width: 400 } },
})

/** A cross-origin isolated origin severs a popup's opener, so the mode cannot be declared. */
export const UNREACHABLE_POPUP = defineConfig({
  ...IDENTITY,
  isolation: 'require-corp',
  // @ts-expect-error popup is unreachable from a cross-origin host on an isolated origin
  display: { modes: ['embedded', 'popup'] },
})

/** Standalone is severed by the same rule as popup. */
export const UNREACHABLE_STANDALONE = defineConfig({
  ...IDENTITY,
  isolation: 'credentialless',
  // @ts-expect-error standalone is unreachable from a cross-origin host on an isolated origin
  display: { modes: ['standalone'] },
})

/** The popup defaults configure a mode the origin cannot serve, so they go with it. */
export const UNREACHABLE_POPUP_DEFAULTS = defineConfig({
  ...IDENTITY,
  isolation: 'require-corp',
  // @ts-expect-error the popup section configures a mode this origin cannot serve
  display: { modes: ['embedded'], popup: { width: 400 } },
})
