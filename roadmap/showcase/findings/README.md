# Findings Registry

Friction found while building demos against published `@hyperfrontend/*` packages, filed via the `demo-findings` skill.

The registry tracks **open friction only**: when a finding is resolved, its row and file are removed entirely; IDs are never reused. Declined findings move to [declined.md](declined.md) with a one-line reason.

## Open

| ID    | Title                                                                                                                                                     | Category    | Severity | Surfaced by    | Status | Disposition |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | -------------- | ------ | ----------- |
| F-005 | [`shell.on` handlers are implicitly `any`: published entry types reference root exports that don't exist](005-published-dts-missing-root-type-exports.md) | packaging   | medium   | demo-heartbeat | open   | —           |
| F-006 | [`hf dev` 404s directory URLs: only `/` maps to an index.html](006-dev-server-no-directory-index.md)                                                      | dx-papercut | low      | demo-heartbeat | open   | —           |
| F-008 | [`resetBody` silently forces `background: transparent`, blanking the feature page's own body background](008-resetbody-forces-transparent-background.md)  | docs-gap    | low      | demo-heartbeat | open   | —           |
