# Findings Registry

Friction found while building demos against published `@hyperfrontend/*` packages, filed via the `demo-findings` skill.

The registry tracks **open friction only**: when a finding is resolved, its row and file are removed entirely; IDs are never reused. Declined findings are removed the same way, with the reason recorded in the commit that clears them.

## Open

| ID    | Title                                                                                                                                                                | Category     | Severity | Surfaced by       | Status  | Disposition    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ----------------- | ------- | -------------- |
| F-013 | [A use case for a group channel: all participants mix in their salts and talk on one bus](013-group-channel-with-mixed-salt-key-agreement.md)                        | other        | low      | demo-koi-pond     | open    | —              |
| F-018 | [A dead frame and a slow frame raise the same error, and nothing brings a dead session back](018-no-way-to-revive-a-session-whose-frame-died.md)                     | api-friction | high     | demo-koi-pond     | triaged | api-refinement |
| F-019 | [A dead feature frame stays mounted, so the browser paints its crash placeholder into my page](019-dead-iframe-left-mounted-paints-the-browser-crash-placeholder.md) | api-friction | medium   | demo-koi-pond     | triaged | api-refinement |
| F-022 | [Channel destruction is unobservable, so a peer-destroyed feature keeps its reporters running](022-channel-destruction-is-unobservable.md)                           | api-friction | low      | jest-to-node-test | open    | —              |
