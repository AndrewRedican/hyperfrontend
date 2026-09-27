# Findings Registry

Friction found while building demos against published `@hyperfrontend/*` packages, filed via the `demo-findings` skill.

The registry tracks **open friction only**: when a finding is resolved, its row and file are removed entirely; IDs are never reused. Declined findings are removed the same way, with the reason recorded in the commit that clears them.

## Open

| ID    | Title                                                                                                                                         | Category     | Severity | Surfaced by       | Status | Disposition |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ----------------- | ------ | ----------- |
| F-013 | [A use case for a group channel: all participants mix in their salts and talk on one bus](013-group-channel-with-mixed-salt-key-agreement.md) | other        | low      | demo-koi-pond     | open   | —           |
| F-022 | [Channel destruction is unobservable, so a peer-destroyed feature keeps its reporters running](022-channel-destruction-is-unobservable.md)    | api-friction | low      | jest-to-node-test | open   | —           |
