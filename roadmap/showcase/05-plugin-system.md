# 05 — Plugin System: Notional Remainder

The registration + lifecycle seam (`ShellOptions.plugins`, `onMount`/`onUnmount`, element per display mode) is live in the published SDK. What remains here is **exploratory design only**: a plugin taxonomy the seam could host, and a first showcase-internal plugin to dogfood it.

**Type** Discovery · **Status**: Notional — nothing below is committed scope.

See [00-strategy.md](00-strategy.md) and the [index](README.md).

## Carried decisions (standing constraints)

- "Formalize the plugin escape hatch only" (locked) — do **not** build a full host-side positioning API into the SDK; coordination logic lives in demo code.
- The SDK ships **no built-in plugins** (locked) — anything below is a **showcase-internal** tool, not shipped in `@hyperfrontend/features`.

## Notional — the plugin taxonomy

Four categories the generalized seam could host; only the element-capture use exists today:

- **Opt-in helpers** — convenience behaviors a consumer turns on.
- **Behavior adapters** — adjust how a feature responds within the host.
- **UI modifiers** — decorate or augment the surfaced feature.
- **Developer / debugging utilities** — inspection and diagnostics (the first such plugin, below).

## Notional — first plugin (showcase-internal): debug / inspection suite

Purpose: identify which visible app / feature area the user is interacting with, and inspect it. "Baked-in" means always available in the showcase, not a published SDK feature.

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

**Predicted finding (dogfooding).** Built against the _public_ seam, the panel needs data the current `ExperiencePluginContext` does not expose — it only hands over `element` + `displayMode`, whereas the panel needs the host's connection graph, per-app status, and message log. Building this will almost certainly surface a finding: _the plugin context must expose richer (read-only) host introspection._ Capturing that friction is the point.

## Open questions

- How much host introspection the seam should expose (driven by the debug-suite finding above) — and whether any of it is privileged vs. public.
