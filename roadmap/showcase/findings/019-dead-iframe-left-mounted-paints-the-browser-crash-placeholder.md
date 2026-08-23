# F-019 — A dead feature frame stays mounted, so the browser paints its crash placeholder into my page

| Field        | Value                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Category     | api-friction                                                                                                               |
| Severity     | medium                                                                                                                     |
| Surfaced by  | demo-koi-pond                                                                                                              |
| Status       | triaged                                                                                                                    |
| Disposition  | api-refinement                                                                                                             |
| Graduated to | [koi pond phase 2, gallery outer resurrection](../16-koi-pond/phase-2-isolated-improvements.md#gallery-outer-resurrection) |

## What happened

When a feature's frame dies mid-run and the watchdog gives its `unresponsive`
verdict, the default `onUnresponsive: 'emit'` policy leaves the iframe element in the
DOM. A killed frame's element is repainted by the browser itself with an opaque
white crash placeholder (the sad-face / broken-document tile), so the host page shows
a browser artifact it never mounted, styled by nobody, on top of whatever visual
design the host had. Only `'unmount'` removes the element, but that also gives up the
session entirely.

## Why it's friction (consumer lens)

The consumer opted into `emit` to stay in charge of the failure UX, and instead got
the one element on the page they cannot style. There is no middle policy between
"keep the corpse" and "destroy everything": nothing like "emit, and blank the mount".
The koi pond hides the host-owned container as a workaround, which works only because
the host happens to own a wrapper element; a host that handed the SDK a bare
container has nothing to hide.

## Proposed fix / improvement

On the unresponsive verdict (or on a future dead-frame verdict, see F-018), give the
mount a neutral state: hide or remove the dead iframe while keeping the session
re-openable, or expose a policy option such as `onUnresponsive: 'emit-and-conceal'`.

## Repro / evidence

Embed any feature, kill its frame's process (Android task kill, or `chrome://crash`
navigation inside the frame), wait for `error { reason: 'unresponsive' }`, and
observe the iframe still in the DOM showing the browser's placeholder. Worked around
in `apps/demos/koi-pond/host/src/scene/stage.ts` (`setLayerPresent` hides the layer)
plus the re-open in `resurrection.ts`, which replaces the mount.
