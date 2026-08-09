# F-010 — the `hf dev` debug UI takes port 4280 with no way to move it from `hf-dev.config.*`

| Field        | Value         |
| ------------ | ------------- |
| Category     | api-friction  |
| Severity     | medium        |
| Surfaced by  | demo-koi-pond |
| Status       | open          |
| Disposition  | —             |
| Graduated to | —             |

## What happened

`hf-dev.config.ts` lets a consumer pin every app's port:

```ts
export default defineDevConfig({
  apps: [{ name: '@hyperfrontend/demo-koi-pond', outputDir: '…', port: 4282 }],
})
```

There is no equivalent key for the debug UI. It defaults to **4280** and can only be moved with
the `--port` CLI flag, so the port a consumer must remember lives in a different place from
every other port they configured — in a `package.json` script rather than the config file whose
whole job is ports.

Running a bare `hf dev` in this repo prints:

```
  @hyperfrontend/demo-koi-pond → http://localhost:4282/
Debug UI: http://localhost:4280/
```

4280 is the port the clock demo pins its **app** to in its own `hf-dev.config.ts`. Two demos in
one repository, each configured entirely through the sanctioned config file, land on the same
port — and nothing warns about it. Whichever starts second either fails to bind or the visitor
opens one expecting the other.

## Why it's friction (consumer lens)

A consumer reads `defineDevConfig`, sets their ports, and reasonably believes the dev server's
ports are now fully described. The one port they did not choose is the one that collides. The
failure is also silent in the common direction: the debug UI happily takes a port an app
intends to use later in the session.

Any consumer running more than one feature locally — which is the normal case once a product
has a second feature — hits this.

## Proposed fix / improvement

1. Accept a `debugPort` (or `debug: { port }`) key in `defineDevConfig`, with `--port` still
   overriding it, so every port a consumer cares about is declared in one file.
2. Fail loudly when the resolved debug port equals a configured app port, naming both.
3. Failing that, default the debug UI to a port outside the range the docs suggest for apps.

## Repro / evidence

```bash
cd apps/demos/koi-pond/host && npx hf dev
# →  @hyperfrontend/demo-koi-pond → http://localhost:4282/
# →  Debug UI: http://localhost:4280/
curl -o /dev/null -w '%{http_code}\n' http://localhost:4280/   # 200 — the clock demo's app port

grep -n 'port' ../../clock/hf-dev.config.ts                    # port: 4280
```

**Workaround in the demo:** `apps/demos/koi-pond/host/package.json` runs
`hf dev --port 4290`, duplicating port configuration outside `hf-dev.config.ts`.
