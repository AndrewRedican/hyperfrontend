# Published Package Defects

Defects in published `@hyperfrontend/*` packages, found while writing the guide corpus and
reproduced against the published tarballs rather than against workspace source.

This is the sibling of [showcase/findings](showcase/findings/README.md): that registry tracks
API _friction_ a demo hit, filed through the `demo-findings` flow. This file tracks _defects_,
where a shipped package does something other than what it documents or intends.

Same discipline: **open items only**. When one is fixed, delete its row and its section in the
commit that fixes it. Every entry states how it was reproduced, what it blocks, and what to do
about the documentation once it lands.

Reproduced on Node 24.18.1 against the versions named, 2026-08-25.

| #    | Package                                    | Defect                                                                  | Severity |
| ---- | ------------------------------------------ | ----------------------------------------------------------------------- | -------- |
| D-01 | builder / project-scope / network-protocol | Dedupe pass drops renamed builtin imports, breaking ESM output          | high     |
| D-02 | package-e2e (all)                          | The ESM lane is not real ESM, so D-01 shipped unnoticed                 | high     |
| D-03 | generated feature shells                   | `require()` resolves to an empty object                                 | high     |
| D-04 | ui-utils                                   | No working TypeScript declarations                                      | high     |
| D-09 | logging                                    | A channel shares its level with its parent in both directions           | medium   |
| D-10 | state-machine                              | Nothing makes `init` run once under concurrent callers                  | medium   |
| D-11 | versioning                                 | `createIndependentFlow` cascade steps are no-op stubs reporting success | medium   |
| D-12 | ui-utils                                   | `syncElementDimensions` copies the source's inline `position`           | low      |

---

## D-01 — the dedupe pass drops renamed builtin imports, breaking ESM output

`builder@0.2.0`, `project-scope@0.2.4`, `network-protocol@0.2.1`. CJS is unaffected throughout.

`libs/builder/src/bundle/dedupe/attribute-modules.ts:94` defines
`baseName = (name) => name.replace(/\$\d+$/, '')`, and `extract-chunk.ts:115-120` resolves a
reference through it. For `join$1` inside the module that itself exports `join`, the owner
resolves to the module's own export, so the reference is treated as local and no import is
emitted. Rollup renames a builtin import whenever it collides with a local name, so any module
that re-exports a same-named helper loses its import.

Reproduced, three shapes:

- **project-scope** throws at call time. 19 root symbols raise `join$1 is not defined`, and the
  whole VFS `Tree` surface raises `isAbsolute$1 is not defined`. All 30 subpaths import cleanly,
  so narrowing the entry point is not a workaround; only `createRequire` is. Worse,
  `findFilesInTree` and `walkTree` swallow the failure and return empty results:
  `findFilesInTree(tree, '**/*.ts')` gives `[]` under ESM and `["src/index.ts"]` under CJS, with
  no error either way.
- **network-protocol** fails to link. 16 of 18 subpaths report that
  `_shared/lib/data/creators/mocks/index.esm.js` provides no export named `data`, because that
  extracted chunk is three lines long (`var id = "/v4"`) while eight sibling chunks import seven
  names from it. Only `./security` and `./topic` load.
- **builder** fails to link on 8 of 21 subpaths: the root and the three `./bin*` entries on a
  `postject` named export, and the four `./bundle/*` entries on `__dirname is not defined` in ES
  module scope.

One fix in the dedupe pass (do not strip `$N` when the ref is a known import binding, or check
`importBindings` before `ownerOf`) plus a rebuild and release of all three closes this.

**Docs follow-up.** This is the single highest-leverage fix in the corpus: it unblocks the whole
project-scope slate, the network-protocol slate, and the ESM half of the builder and versioning
guides. Until it lands, no guide may show a plain `import` from these three packages. The shipped
[read-another-tools-config-file](../apps/docs-site/content/guides/read-another-tools-config-file/guide.md)
guide is unaffected because config detection and parsing do not route through the broken chunk.

## D-02 — the ESM package-e2e lane is not real ESM

Every publishable library has an `esm` e2e config, and none of them proves the ESM entry works.
`apps/package-e2e/project-scope/src/esm.spec.ts` asserts `expect(typeof X).toBe('function')` for
each import and never calls anything, so a call-time `ReferenceError` is invisible. Separately,
the lane runs under jest, whose module handling accepts subpaths that Node rejects outright:
network-protocol's ESM spec passes green against the same tarball a plain `.mjs` import fails on.

That combination is why D-01 shipped across three packages.

**Docs follow-up.** None directly, but until a real native-ESM smoke exists (a plain `.mjs` or
`node --input-type=module` run against the packed tarball) every "verified against the published
package" claim in an authored-lane guide has to be re-run by hand rather than trusted to CI.

## D-03 — `require()` of a generated shell resolves to an empty object

All three vendored shells (`demo-clock-shell@0.3.0`, `demo-heartbeat-shell@0.2.0`,
`demo-koi-pond-shell@0.2.0`) declare `"type": "module"` while mapping `exports['.'].require` to
`./index.cjs.js`. That file is genuine CommonJS (`'use strict'`, `exports.createFeatureShell =`),
but the `.js` extension under `"type": "module"` makes Node parse it as ESM.

`require('@hyperfrontend/demo-clock-shell')` does not throw. It returns `{}`, and
`createFeatureShell` is `undefined`, so the failure surfaces later as a call on undefined, far
from its cause. `import()` of the same package works and returns the factory. Confirmed on all
three shells.

This is the mirror of D-06: there an inherited `commonjs` breaks the ESM entry; here an emitted
`module` breaks the CJS entry.

**Docs follow-up.** Shapes the planned "embed a shell in a React/Next.js host" guide: a
Pages-Router host, or any `require`-based path, cannot load a generated shell today. That guide
must either wait for the fix or state the ESM-only constraint as a prerequisite. The shipped
[embed-a-shipped-feature](../apps/docs-site/content/guides/embed-a-shipped-feature/guide.md)
guide is unaffected because it imports.

## D-04 — ui-utils ships no working TypeScript declarations

`ui-utils@0.0.6`. Every `.d.ts` in the package is a pure re-export cycle: `style/index.d.ts` is
`export { addStylesheet, … } from '..'` while the root re-exports the same names from
`./style`. There is no leaf declaration anywhere.

A five-line consumer importing `addStylesheet` under `tsc` 5.x, `NodeNext`, `strict` produces 77
`TS2303 Circular definition of import alias` errors and degrades every exported symbol to
error-`any`. This is also why nothing caught D-12 or the wrong element-creator examples.

**Docs follow-up.** Any ui-utils guide must use `js` fences until this is fixed. The shipped
[style-a-widget-you-inject-into-someone-elses-page](../apps/docs-site/content/guides/style-a-widget-you-inject-into-someone-elses-page/guide.md)
already does, by accident rather than by decision; leave it alone but do not treat it as
precedent for a `ts` fence once the declarations work.

## D-09 — a logging channel shares its level with its parent in both directions

`logging@0.1.1`. A channel borrows the parent's level, which is documented, but
`channel.setLogLevel` moves the parent too:

```js
parent.setLogLevel('info')
const net = parent.channel('net')
net.setLogLevel('debug')
parent.getLogLevel() // => 'debug'
```

So "turn on debug for just the network channel", the most likely follow-up for anyone who has
just discovered channels, silences or floods everything else instead.

**Docs follow-up.** The planned runtime-verbosity guide must state this in one line rather than
implying per-channel control. The shipped
[instrument-a-cli-with-logging](../apps/docs-site/content/guides/instrument-a-cli-with-logging/guide.md)
tutorial is accurate as written: it says a channel borrows the root's level and only ever calls
`setLogLevel` on the root.

One smaller logging item in the same pass: the README's Winston adapter example binds five
methods positionally in an order that drops an entire level.

## D-10 — nothing makes `init` run once under concurrent callers

`state-machine@0.2.0`, `LifecycleAwareComponent`. The replay half of this entry is fixed: a
handler registered while a flag is already `true` now receives the current value on its own,
and handlers that registered earlier are no longer re-run.

What remains is that nothing in the base class makes `init` idempotent under concurrent callers. A
subclass that guards on `this.ready` still opens N resources for N callers that arrive during
the setup await, because the flag only flips after it resolves. Every subclass has to memoize
the in-flight promise itself.

The shipped class `@example` also fails to compile (`TS2654`), and the natural method-form
subclass is a type error (`TS2425`); only the field form works.

**Docs follow-up.** The shipped
[make-a-service-safe-to-use-before-it-is-ready](../apps/docs-site/content/guides/make-a-service-safe-to-use-before-it-is-ready/guide.md)
guide teaches the field form and the in-flight promise, and its examples are verified against
0.2.0. Its idempotent-handler advice comes out with the replay fix. If the base class grows a
concurrency guard, step 2 of that guide collapses to a much shorter one and should be rewritten
rather than left teaching a workaround.

## D-11 — `createIndependentFlow`'s cascade steps are no-op stubs

`versioning@0.6.3`. `createIndependentFlow`'s two cascade steps are no-op stubs that report
`status: 'success'`, so a caller cannot tell the work did not happen. The misleading `@example` that told
readers to log a never-written `cascadedBumps` field is corrected, but the stubs themselves are
unimplemented.

The 100-commit window that the original entry filed alongside this is **not a defect**: the cap is the
intended behaviour of `getCommitsSince`, and lifting it at the `analyze-commits` call sites was considered
and rejected. `maxCommitFallback` remains the knob for a release whose base is further back.

**Docs follow-up.** The cascade guide cannot teach the flow-shaped API until the stubs are implemented; the
`calculateCascadeBumps` chain underneath works and is what that guide should teach meanwhile.

## D-12 — `syncElementDimensions` copies the source's inline `position`

`ui-utils@0.0.6`. The `onSuccess` half of this entry is fixed: both element lookups still overwrite
`onSuccess` internally, but the caller's callback is now re-emitted once from `onTargetElementFound`,
after the first sync has been applied, and receives the target element.

What remains is a **deferred decision**, not an agreed defect. `syncDimensions` writes `top`/`left` from
`getBoundingClientRect()`, which are viewport coordinates, and then copies the source's **inline**
`position` onto the target. Those two are incoherent with each other: only `fixed` reads `top`/`left` as
viewport coordinates, `absolute` resolves them against the target's offsetParent, and `static` ignores
them. A source carrying `position: static` therefore stamps that onto the overlay and destroys pinning.

Pinning the target with `fixed` was implemented and then reverted. It is a design decision rather than a
derivation: `fixed` behaves differently inside a transformed ancestor, and a caller whose source is
inline-`absolute` with a viewport-anchored offsetParent has working code today that it would change. The
alternatives are to leave `position` untouched and document that the caller owns it, or to add an opt-in
option. **Pending a call on which of the three to take.**

**Docs follow-up.** The planned element-tracking guide must tell the reader to set the overlay's
`position` from their own stylesheet, and use `js` fences until D-04 is fixed. `onElementResize` and
`getElementAsync` are sound and their examples are accurate.
