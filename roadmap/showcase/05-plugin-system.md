# 05 — Plugin System Implementation

Build the plugin system for real: today `ExperiencePlugin` is an exported _type with zero implementation_. The committed cut is the **registration + lifecycle seam** — generalized so it can carry any kind of plugin, not just animation. The same hook that registers a plugin hands a demo the container element it needs for visual choreography, so this one plan unlocks both the plugin showcase and every spectacle demo.

**Depends on** [04](04-demo-1-clock.md) · **Type** Execution · **Status**: **Committed cut delivered** (2026-07-03) — the registration + lifecycle seam shipped with the v2 fix cut ([13-v2-release.md](13-v2-release.md)): `ShellOptions.plugins`, `onMount` after mount / awaited `onUnmount` before unmount, element per display mode (embedded → iframe, dialog → container root, popup/standalone → `null`), rejected hooks surfaced via the `error` event, zero-plugin shells byte-identical to before. The taxonomy and the showcase-internal debug/inspection plugin below remain **notional**; richer host introspection stays the predicted follow-on finding.

See [00-strategy.md](00-strategy.md) (journey J2) and the [index](README.md).

## The gap (today)

- `ExperiencePlugin` / `ExperiencePluginContext` are exported **types only** ([../../libs/features/src/host/plugins.ts](../../libs/features/src/host/plugins.ts)).
- `onMount`/`onUnmount` are invoked **nowhere** in `libs/features/src` (grep → zero call sites).
- `ShellOptions` has **no** `plugins` field ([../../libs/features/src/shared/types.ts](../../libs/features/src/shared/types.ts)).

## Scope — the committed seam

- Add a registration field to `ShellOptions` (`plugins` or `experience`).
- Wire invocation into the mount/unmount lifecycle across **all four** display modes: `onMount` after mount (returns optional teardown), `onUnmount` before unmount (await its promise so exit animations complete).
- Define what `element` is per display mode (iframe for embedded; dialog container for dialog; etc.).
- **Generalize the registration** so the seam is not animation-specific: the same registration + lifecycle entry point can host the plugin categories below, even though only the element-capture / animation use is exercised in this cut.
- Tests (meet the [lib-builder/lib coverage gate](../feature/README.md) discipline) + docs.
- Formalize as the **official element-capture / lifecycle seam** — the consumer owns the choreography; the SDK only hands over the element + display mode.

## Carried decisions

- "Formalize the plugin escape hatch only" (locked) — do **not** build a full host-side positioning API into the SDK; coordination logic lives in demo code. Generalizing the _registration_ to carry more plugin kinds is orthogonal to this: it adds categories, not a positioning API.
- The SDK ships **no built-in plugins** (locked) — the debug suite below is a **showcase-internal** tool, not shipped in `@hyperfrontend/features`.

## Notional — the plugin taxonomy

> _Exploratory, not committed scope._ The seam above is built to _accommodate_ these; only the element-capture use ships in this cut.

Four notional categories the generalized seam could host:

- **Opt-in helpers** — convenience behaviors a consumer turns on.
- **Behavior adapters** — adjust how a feature responds within the host.
- **UI modifiers** — decorate or augment the surfaced feature.
- **Developer / debugging utilities** — inspection and diagnostics (the first such plugin, below).

## Notional — first plugin (showcase-internal): debug / inspection suite

> _Exploratory design, not committed scope._ Built **into the showcase / gallery** (not shipped in the SDK) as the first real plugin authored against the committed seam — dogfooding it. "Baked-in" means always available in the showcase, not a published SDK feature.

Purpose: identify which visible app / feature area the user is interacting with, and inspect it.

**Inspect mode** — while `Ctrl` is held and the pointer is over a feature app:

- change the cursor to a help / inspection cursor;
- draw a thin **1px** border around the app's visible area;
- use an inverted-color (or equivalent) border so it stays high-contrast over arbitrary backgrounds.

**Inspect panel** — `Ctrl` + left- or right-click anywhere inside an app opens a non-intrusive panel showing:

- app name; app ID;
- connected apps / features (names + IDs);
- current status;
- message count;
- an expandable message / log view.

**Logs view**:

- a small embedded log window;
- newest **10** entries by default;
- an option to **download all** events / logs captured since debug mode was enabled.

**Predicted finding (dogfooding).** Built against the _public_ seam, the panel needs data the current `ExperiencePluginContext` does not expose — it only hands over `element` + `displayMode` ([plugins.ts:8-13](../../libs/features/src/host/plugins.ts#L8-L13)), whereas the panel needs the host's connection graph, per-app status, and message log. Building this will almost certainly surface a v2 finding: _the plugin context must expose richer (read-only) host introspection._ Capturing that friction is the point.

## Open questions

- Field name (`plugins` vs `experience`); ordering / multiple plugins.
- `element` identity per display mode (especially popup / standalone, where there is no in-document element).
- Teardown error handling and what happens if `onUnmount` rejects.
- How much host introspection the seam should expose (driven by the debug-suite finding above) — and whether any of it is privileged vs. public.
