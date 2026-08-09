# Findings Registry

Friction found while building demos against published `@hyperfrontend/*` packages, filed via the `demo-findings` skill.

The registry tracks **open friction only**: when a finding is resolved, its row and file are removed entirely; IDs are never reused. Declined findings move to [declined.md](declined.md) with a one-line reason.

## Open

| ID    | Title                                                                                                                                                                     | Category        | Severity | Surfaced by   | Status | Disposition |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------- | ------------- | ------ | ----------- |
| F-009 | [`hf dev` still won't serve `/sub-path/`, which blocks any feature that ships more than one app on one origin](009-dev-server-directory-index-blocks-multi-app-origin.md) | missing-feature | blocker  | demo-koi-pond | open   | —           |
| F-010 | [The `hf dev` debug UI takes port 4280 with no way to move it from `hf-dev.config.*`](010-debug-port-not-configurable-and-collides.md)                                    | api-friction    | medium   | demo-koi-pond | open   | —           |
| F-011 | [A host with seven open features receives ~9 messages a second in total, and silently drops the rest](011-message-delivery-collapses-across-concurrent-channels.md)       | api-friction    | high     | demo-koi-pond | open   | —           |
| F-012 | [Every distribution draws from `Math.random`, so nothing reproducible can use them](012-no-seeded-randomness-for-any-distribution.md)                                     | missing-feature | medium   | demo-koi-pond | open   | —           |
| F-013 | [A use case for a group channel: all participants mix in their salts and talk on one bus](013-group-channel-with-mixed-salt-key-agreement.md)                             | other           | low      | demo-koi-pond | open   | —           |
