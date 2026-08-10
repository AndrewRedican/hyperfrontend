# F-009 — `hf dev` still won't serve `/sub-path/`, which blocks any feature that ships more than one app on one origin

| Field        | Value           |
| ------------ | --------------- |
| Category     | missing-feature |
| Severity     | blocker         |
| Surfaced by  | demo-koi-pond   |
| Status       | open            |
| Disposition  | —               |
| Graduated to | —               |

## What happened

The koi pond deploys as **one origin** carrying eight apps: the pond host at `/` and each of
the seven koi at `/fish-<name>/`. That shape is the point — the fish are same-origin sub-paths,
so the pond host resolves them against its own location and no origin list, environment
variable, or CORS configuration exists anywhere in the demo.

Serving the composed tree with `hf dev` and asking for a koi:

```
/fish-vanilla/             404
/fish-vanilla              404
/fish-vanilla/index.html   200
```

The file is there — `dist/apps/demos/koi-pond/site/fish-vanilla/index.html` — and every static
host tried (`http-server`, `vite preview`, Railway) serves all three of those paths. Only the
SDK's dev server refuses the two directory forms.

The pond's host mounts each koi with `new URL('fish-<name>/', window.location.href)`. Under
`hf dev` all seven frames therefore load a 404 page, no handshake ever completes, and the
curtain sits over an empty pond until its deadline. The demo cannot be developed against the
tool that exists to develop demos.

This is the same gap as the already-resolved F-006. Filing a new ID because IDs are never
reused, but it should be triaged as a regression or an incomplete fix rather than a fresh
report.

## Why it's friction (consumer lens)

A consumer with one app never notices, because `/` is special-cased. The moment a feature is a
_family_ — a host plus several apps behind it, or any product that ships more than one entry
point on an origin — every sub-path is unreachable in development while working perfectly in
production. That is the worst shape for a defect: it only appears in the tool you use to
iterate, and it looks like your own routing is broken.

Directory-index resolution is table stakes for a static file server. Nothing else in the
toolchain behaves this way, so there is no reason for a consumer to suspect the dev server.

## Proposed fix / improvement

Resolve a request for `<dir>` or `<dir>/` to `<dir>/index.html` when that file exists, before
falling through to 404. Keep the existing `/` behaviour unchanged. A redirect from `<dir>` to
`<dir>/` would also be conventional but is not required to unblock this.

## Repro / evidence

```bash
npx nx run demo-koi-pond:build
npx nx run demo-koi-fish-vanilla:build
cd apps/demos/koi-pond/host && npx hf dev          # serves dist/apps/demos/koi-pond/site

curl -o /dev/null -w '%{http_code}\n' http://localhost:4282/fish-vanilla/           # 404
curl -o /dev/null -w '%{http_code}\n' http://localhost:4282/fish-vanilla/index.html # 200

# Any ordinary static server serves all three forms from the same tree:
npx http-server dist/apps/demos/koi-pond/site -p 4288
curl -o /dev/null -w '%{http_code}\n' http://localhost:4288/fish-vanilla/           # 200
```

**Workaround in the demo:** `apps/demos/koi-pond/host/src/scene/koi-sessions.ts` mounts each koi
from an explicit `fish-<name>/index.html` and shows the clean `fish-<name>/` form in the hover
card and roster. Two URLs for one app, purely to satisfy the dev server.
