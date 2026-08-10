# F-014 — Declaring only the display mode my feature actually has makes `hf build` emit code that cannot compile

| Field        | Value                     |
| ------------ | ------------------------- |
| Category     | packaging                 |
| Severity     | high                      |
| Surfaced by  | demo-koi-fish-\* (shells) |
| Status       | open                      |
| Disposition  | —                         |
| Graduated to | —                         |

## What happened

A koi feature only ever renders embedded — it is composited into a host-owned transparent
layer, and dialog/popup/standalone presentations are meaningless for it. Its
`feature.config.ts` therefore declared the honest thing:

```ts
display: {
  modes: ['embedded'],
},
```

`hf build --ci --allow-open` then failed in the generated shell's declaration pass
(SDK 0.5.1):

```
[plugin typescript] .hf-shell--…/src/index.ts (581:42): TS2345:
  Types of property 'onUnresponsive' are incompatible.
    …
    Type 'UnresponsiveInfo' is not assignable to type 'FeatureUnresponsiveInfo'.
      Types of property 'displayMode' are incompatible.
        Type 'DisplayMode' is not assignable to type '"embedded"'.
```

The generator narrows the shell's `FeatureDisplayMode` to the declared modes union —
which is exactly the typed-shell value proposition — but then hands the consumer's
narrowed `onUnresponsive` callback straight to `createShell`, whose `UnresponsiveInfo`
carries the SDK-wide `DisplayMode`. Function-parameter contravariance makes any _strict
subset_ of the four modes uncompilable. Declaring all four modes builds fine, which is
why the clock, heartbeat, and pond shells never hit this.

## Why it's friction (consumer lens)

The config invites me to declare only the modes my feature supports ("other modes are
excluded from the generated shell"), and the build punishes me for doing so with a
TypeScript error deep inside a staging directory I never wrote, pointing at generated
code. The failure reads like my contract or config is wrong; nothing suggests the fix is
"declare presentation modes your feature does not have". The workaround also degrades the
shell: hosts get offered `dialog`/`popup`/`standalone` mounts that are semantically
meaningless for the feature, and the mode subset stops being load-bearing documentation.

## Proposed fix / improvement

In the generated shell, widen at the boundary instead of leaking the narrowed union into
SDK positions: wrap the consumer's `onUnresponsive` so the generated callback receives the
SDK's `UnresponsiveInfo` and re-narrows `displayMode` internally (a mounted single-mode
shell can only ever be unresponsive in a declared mode), or type the generated
`FeatureUnresponsiveInfo.displayMode` as the SDK `DisplayMode`. Either keeps single-mode
shells compiling without changing runtime behaviour. A regression test packing a
`modes: ['embedded']` feature would pin it.

## Repro / evidence

`apps/demos/koi-pond/fish-vanilla` with `display.modes: ['embedded']` in
`feature.config.ts`, then `npx hf build --allow-open --out /tmp/shell` → the TS2345 above,
twice (ESM and CJS passes). Restoring all four modes builds cleanly. The fish
feature.configs declare all four modes as the workaround.
