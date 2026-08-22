# SDK `hosted` signal (lib-features)

Part of [Phase 2](README.md) · Guardrails: [plan index](../README.md) · Evidence:
[recon §2](../recon.md#2-scene-signals-when-a-pond-can-know-card-vs-full)

## Goal

Expose, on the feature-side handle, the fact the SDK already knows synchronously: whether
this feature is hosted at all. `FeatureHandle` gains a readonly `hosted: boolean`,
available immediately after `createFeature` returns, before any handshake.

This is the plan's only SDK change. It exists because a standalone pond must not wait out
a fallback deadline to learn nobody will ever announce anything: `ready()` never settles
unhosted, `displayMode` stays null forever, and the doctrine (correctly) forbids apps from
sniffing `window.parent` themselves. The SDK is the one party allowed to know.

## The change

- **Source of truth:** `resolveHostWindow` (`libs/features/src/hostee/lifecycle.ts:31`),
  which returns the parent or opener window, or null for a top-level document. It is
  module-internal and stays that way; the handle exposes the derived boolean.
- **Surface:** a readonly `hosted: boolean` member on `FeatureHandle`, declared in
  `libs/features/src/hostee/types.ts` beside `displayMode`, and set in
  `createFeatureHandle` (`libs/features/src/hostee/lifecycle.ts:77-193`), which already
  receives the resolved host window as its second parameter: `createFeature` passes
  `resolveHostWindow(window)` in and needs no change. The value is a plain
  `hosted: hostWindow !== null` property on the frozen handle literal (`lifecycle.ts:172`),
  not a getter: the fact never changes, and `freeze` makes the property immutable at
  runtime, not just in types. True when a host window exists (iframe parent or window
  opener), false when top-level.
- **Honest semantics:** `hosted: true` means a candidate host window exists and the
  channel is armed toward it; it does not promise the host will speak. A document iframed
  by a page that runs no SDK host reads `hosted: true` and then sees the existing
  `ready-timeout` error path. Connection state stays with `ready()`, `open`, and the
  lifecycle events; document `hosted` in exactly those terms.
- **Relationship to `displayMode`:** `hosted` is synchronous and static; `displayMode`
  remains null until the host's Present announcement and describes _how_ the feature is
  shown. Document both members so the distinction is unmissable: `hosted` answers "is
  there a host at all", `displayMode` answers "how did it mount me".
- **Vocabulary trap:** never describe `hosted: false` as "standalone" in any shipped
  prose. `DisplayMode.Standalone` already names a _hosted_ arrangement: a host-opened
  tab, which has an opener, so it reads `hosted: true` with `displayMode` eventually
  `'standalone'`. The unhosted case is "top-level" or "a direct visit" (the codebase
  already says "unembedded" at `lifecycle.ts:66`). All four display modes are hosted;
  `hosted: false` has no display mode, ever. This asymmetry is the cleanest proof the two
  members are separate concerns.
- **No new subpath, no new export:** a member on an existing exported interface. This
  matters for the docs pipeline (below): the API reference and search index pick it up
  automatically.
- **Semver:** new public API, so the release commit is a `feat` and the package must bump
  minor. See the [phase README release-order warning](README.md#release-order-warning-gates-phase-3).

## Ripples this signal retires (tracked, not changed here)

The `window.parent === window` sniff exists today in `originRelation()` in every fish app
(`apps/demos/koi-pond/fish-*/src/runtime/koi-runtime.ts`), feeding the model field
documented at `apps/demos/koi-pond/lib/src/model/card.ts:25`. The lib runtime port
([phase 1, runtime](../phase-1-lib-consolidation.md#runtime)) takes hosted-ness as an
argument, and the [phase 3 migration](../phase-3-instance-model/05-fish-migration.md)
feeds it from this handle, deleting the sniff eight times.

## Recorded future consumer (out of scope here)

Beyond the pond's deferred boot, the fish apps intend to use this signal for
presentation: a koi opened by a direct visit renders a full framework-themed background
of its own instead of a fish swimming on a blank page, while a hosted koi stays
transparent for the pond to compose. Nothing in this plan implements that; it is
recorded because it constrains the API in one way this design already satisfies: the
boolean must be readable synchronously, before first paint decisions, app-side.

## Finding first

No finding exists for this gap; file it as F-020 via the `demo-findings` skill before
implementing (registry: [findings/README.md](../../findings/README.md)). The friction:
building a feature that adapts its boot to being hosted or standalone, with no
doctrine-compliant way to know which, because the SDK holds the fact and does not expose
it.

## Specs

`libs/features` carries a full coverage gate; the new member needs:

- `hosted` is true when a parent window exists (iframe), true for an opener (covers the
  popup and standalone display modes), false top-level.
- Available synchronously: readable before `ready()` is awaited, identical afterward.
- Direct visit: `hosted` false while `displayMode` stays null and `ready()` stays
  pending (the existing top-level spec extends naturally).
- Embedded with no SDK host on the other side: `hosted` true, and the `ready-timeout`
  error path behaves exactly as today.
- Immutable: readonly in types, and assignment on the frozen handle has no effect.

## Documentation impact (the complete surface)

JSDoc (rendered into the API reference automatically):

- `FeatureHandle.hosted` in `libs/features/src/hostee/types.ts`: single-line-summary
  style matching the `displayMode` member beside it; prose contrasts the two. House
  style: one-sentence summary, prose paragraph, no tags for a readonly property.
- `createFeature`'s JSDoc in `libs/features/src/hostee/create-feature.ts` mentions the
  handle now exposing hosted-ness only if the sentence reads naturally as present-state
  ("returns a handle exposing..."); never as an addition.

Markdown, hand-authored:

- `libs/features/src/hostee/README.md`: the primary home. The standalone acknowledgement
  at line 40 ("It applies on a standalone visit too") grows into a short present-state
  paragraph: how a feature distinguishes hosted from standalone (`hosted`), what stays
  null or pending when unhosted (`displayMode`, `ready()`), and that apps never sniff
  `window.parent`. Update the API table row for `FeatureHandle`.
- `libs/features/README.md` (ships to npm): the API Overview table row for `hostee`
  already says "feature init, lifecycle"; extend only if wording stays natural. The Quick
  Start does not need it.
- `libs/features/ARCHITECTURE.md`: the "Core Interfaces" section carries the
  `FeatureHandle` shape; add the member there. The standalone discussion (around the
  "plain `_blank`" paragraph) states the feature-side view of standalone in one sentence.
- `libs/features/CHANGELOG.md`: generated by the versioning flow from the commit; never
  hand-edited.

Docs-site (verify, mostly no edits):

- API reference and search index regenerate automatically:
  `apps/docs-site/scripts/generate-docs.ts` discovers entry points from the package
  `exports` map and TypeDoc renders every documented member; a `FeatureHandle` member
  needs no registration anywhere. The hostee page readme
  (`.generated/docs/features/hostee/readme.md`) regenerates from the submodule README.
- Guides: none require changes. `compose-independent-features` is the only guide touching
  the feature-side runtime; adding a `hosted` snippet to it becomes natural only after the
  pond's deferred boot exists, so that decision belongs to
  [phase 5, guides](../phase-5-integration/02-guides-verification.md).
- Demo READMEs asserting "runtime modes are protocol facts, not URL guesses"
  (`apps/demos/heartbeat/README.md`, `apps/demos/clock/README.md`,
  `apps/demos/koi-pond/README.md`): remain true under this change (the SDK is the
  protocol authority); read them once to confirm no sentence implies "the feature cannot
  know it is standalone".

All prose: present-state only, no trajectory wording, no em dashes in README/JSDoc
(guardrails 1 and 3).

## Verification

```bash
npx nx test lib-features
npx nx lint lib-features --fix
npx nx typecheck lib-features
npx nx format:write --projects=lib-features
npx nx run-many -t test build lint typecheck -p lib-features
```

After release: confirm the published version bumped minor and the API page at
`/docs/libraries/features/hostee` renders the member (docs-site rebuild).
