# railway-service-pins

Require every Railway service to serve through the exact `@hyperfrontend/features` release its demo installs from the registry.

## Rule Details

`.railway/railway.ts` declares the workspace's Railway services, and each one starts with
`npx -y @hyperfrontend/features@<version> serve`. That pin is fetched at deploy time, apart from the
demo's own install, so nothing else keeps it in step with the release the demo was built and tested
against.

This rule reads each `service('<name>', { start: '...' })` call and finds the project whose
`project.json` declares `metadata.deploy` with `provider: "railway"` and that `service`. It then reads
the project's `package-lock.json`: the `node_modules/@hyperfrontend/features` entry must be resolved
from `https://registry.npmjs.org/`, and the pin must equal its `version`. A lock is the offline proof
that a release is published, so the rule never points a service at a version that is only in the
workspace's sources.

It also reports a service that no project deploys to, and a project deploying to a Railway service the
file does not declare.

The pin mismatch is fixable: `--fix` writes the version the lock installs.

### Why?

- **One release per demo**: the server a demo runs under is the release its own tests ran against
- **Published only**: a release still waiting on its publish cannot break the next deploy
- **Bump once**: adopting a release in the demos and forgetting the services fails lint, not production

## Examples

### ❌ Incorrect

A service whose pin lags the release its demo installs (`apps/demos/clock/package-lock.json` resolves
`0.11.5`):

```typescript
const clock = service('clock', {
  start: 'npx -y @hyperfrontend/features@0.11.4 serve --root dist/apps/demos/clock/app --host 0.0.0.0',
})
```

**Error**: `Service 'clock' serves @hyperfrontend/features@0.11.4 but demo-clock installs 0.11.5 from the registry; the pin must be the published version the demo was built with.`

A range, which npx resolves to whatever is newest at deploy time:

```typescript
const clock = service('clock', { start: 'npx -y @hyperfrontend/features@^0.11.0 serve' })
```

**Error**: `Service 'clock' must serve through an exact @hyperfrontend/features@<version> pin.`

A service no demo declares as its `metadata.deploy.service`:

```typescript
const clocks = service('clocks', { start: 'npx -y @hyperfrontend/features@0.11.5 serve' })
```

**Error**: `Service 'clocks' matches no demo's metadata.deploy.service, so its pin cannot be checked against what the demo installs.`

### ✅ Correct

```typescript
const clock = service('clock', {
  start: 'npx -y @hyperfrontend/features@0.11.5 serve --root dist/apps/demos/clock/app --host 0.0.0.0',
})
```

## When Not To Use It

- Services that do not serve through `@hyperfrontend/features`

## Related Rules

- [deploy-static-headers](./deploy-static-headers.md)
- [project-lifecycle-policy](./project-lifecycle-policy.md)
