# Findings Registry

Friction found while building demos against published `@hyperfrontend/*` packages, filed via the `demo-findings` skill.

The registry tracks **open friction only**: when a finding is resolved, its row and file are removed entirely; IDs are never reused. Declined findings are removed the same way, with the reason recorded in the commit that clears them.

## Open

| ID    | Title                                                                                                                                                                                 | Category        | Severity | Surfaced by   | Status  | Disposition    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------- | ------------- | ------- | -------------- |
| F-011 | [A host with seven open features receives ~9 messages a second in total, and silently drops the rest](011-message-delivery-collapses-across-concurrent-channels.md)                   | api-friction    | high     | demo-koi-pond | open    | —              |
| F-012 | [Every distribution draws from `Math.random`, so nothing reproducible can use them](012-no-seeded-randomness-for-any-distribution.md)                                                 | missing-feature | medium   | demo-koi-pond | open    | —              |
| F-013 | [A use case for a group channel: all participants mix in their salts and talk on one bus](013-group-channel-with-mixed-salt-key-agreement.md)                                         | other           | low      | demo-koi-pond | open    | —              |
| F-017 | [A COOP-isolated feature origin makes popup mode hang to open-timeout with no hint why](017-coop-isolated-origin-breaks-popup-mode-silently.md)                                       | confusing-error | medium   | demo-koi-pond | open    | —              |
| F-018 | [A dead frame and a slow frame raise the same error, and nothing brings a dead session back](018-no-way-to-revive-a-session-whose-frame-died.md)                                      | api-friction    | high     | demo-koi-pond | open    | —              |
| F-019 | [A dead feature frame stays mounted, so the browser paints its crash placeholder into my page](019-dead-iframe-left-mounted-paints-the-browser-crash-placeholder.md)                  | api-friction    | medium   | demo-koi-pond | open    | —              |
| F-020 | [A feature opened directly cannot learn it has no host, so an adaptive boot waits out a deadline nobody will answer](020-feature-cannot-know-it-is-unhosted.md)                       | missing-feature | medium   | demo-koi-pond | triaged | api-refinement |
| F-021 | [A visibility edge my page never received parks every watchdog at `unobservable`, and nothing I can call resets it](021-missed-visibility-edge-parks-the-watchdog-for-the-session.md) | api-friction    | high     | demo-koi-pond | open    | —              |
