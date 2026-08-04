# F-008 — `resetBody` silently forces `background: transparent`, blanking the feature page's own body background

| Field        | Value                                                                   |
| ------------ | ----------------------------------------------------------------------- |
| Category     | docs-gap                                                                |
| Severity     | low                                                                     |
| Surfaced by  | demo-heartbeat (standalone feature page styled via a `body` background) |
| Status       | open                                                                    |
| Disposition  | —                                                                       |
| Graduated to | —                                                                       |

## What happened

The feature app styles its page with a `body { background: radial-gradient(…) }` rule in its own stylesheet. With `createFeature(…)` on the page (default options), the standalone page renders with a plain white background instead — the SDK's `resetBody` behavior injects a runtime stylesheet:

```css
html,
body {
  margin: 0;
  padding: 0;
  background: transparent;
  color-scheme: normal;
}
```

Because the SDK's `<style>` is appended when `createFeature` runs, it lands after the app's stylesheet and wins the cascade at equal specificity. The `FeatureOptions.resetBody` JSDoc says only "Whether to neutralize the feature page's body margins/padding; defaults to `true`" — nothing mentions that the background is also forced transparent (or that `color-scheme` is normalized), so the app's dark background disappearing looks like a broken build, not a documented behavior.

## Why it's friction (consumer lens)

Transparent-by-default is a sensible choice for the seamless embed and dialog stories — the surprise is purely that it is undocumented and applies equally on a standalone visit, where there is no host to show through. The consumer's own CSS is silently overridden by a stylesheet they never wrote, and the doc string they consult explicitly scopes the reset to "margins/padding".

## Proposed fix / improvement

Document the full reset (`margin`, `padding`, `background: transparent`, `color-scheme`) in the `resetBody` JSDoc and the hostee README, with the recommended pattern: paint backgrounds on the feature's root layout element, not on `body`. Alternatively scope the background reset to embedded/dialog presentations where transparency is meaningful.

## Repro / evidence

```typescript
// feature page CSS: body { background: #150d11 }
createFeature({ name: 'demo', contract }) // default resetBody
// page renders white; devtools shows an injected <style> with html,body{...background:transparent...} winning the cascade
```

Workaround used in demo-heartbeat: the page background moved from `body` to the app's own root layout element (`.stage`), which the reset does not touch.
