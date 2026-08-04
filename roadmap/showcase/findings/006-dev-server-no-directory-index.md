# F-006 — `hf dev` 404s directory URLs: only `/` maps to an index.html, so multi-page apps need `/host/index.html` spelled out

| Field        | Value                                                                         |
| ------------ | ----------------------------------------------------------------------------- |
| Category     | dx-papercut                                                                   |
| Severity     | low                                                                           |
| Surfaced by  | demo-heartbeat (Vite multi-page build: feature at `/`, host page at `/host/`) |
| Status       | open                                                                          |
| Disposition  | —                                                                             |
| Graduated to | —                                                                             |

## What happened

demo-heartbeat is one Vite multi-page build: the feature page at `index.html` and a host page at `host/index.html`, served from the same output directory. Vite's own `preview`/`dev` servers resolve `/host/` (and `/host`) to `host/index.html`, so the natural URL works there. The `hf dev` static server does not: its path resolution special-cases only `/` → `index.html`, and any other directory path is looked up literally, fails the is-file check, and returns `404 Not Found`. Visiting `http://localhost:4281/host/` under `hf dev` 404s; only the spelled-out `http://localhost:4281/host/index.html` works.

## Why it's friction (consumer lens)

Every other static server in the toolchain (Vite preview, and typical deploy targets) honors directory index resolution, so the URL that works everywhere else silently breaks only under `hf dev` — and a 404 on the dev server reads like a broken build, not a missing URL suffix. Feature apps that ship companion pages (a host harness, docs, a playground) hit this immediately, and the workaround leaks into READMEs and shared links as the uglier `/host/index.html` form.

## Proposed fix / improvement

In the dev server's static handler, when the resolved path is a directory (or the URL ends with `/`), try `<path>/index.html` before 404ing — mirroring Vite preview and common static hosts. A redirect from `/host` to `/host/` would complete the parity.

## Repro / evidence

```bash
# in a feature app whose build emits index.html and host/index.html
npm run build && hf dev
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4281/host/            # 404
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4281/host/index.html  # 200
```

Workaround used in demo-heartbeat: the README and all instructions reference `/host/index.html` explicitly when running under `hf dev`.
