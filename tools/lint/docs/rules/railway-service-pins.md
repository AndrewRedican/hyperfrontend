# railway-service-pins

Require every Railway service to serve through the exact `@hyperfrontend/features` release its demo installs from the registry, or, when its project is deployed as a built service, to start the main its build wrote.

## Rule Details

`.railway/railway.ts` declares the workspace's Railway services. A service either serves its demo
through `npx -y @hyperfrontend/features@<version> serve` or, when its project is deployed as a built
service, starts the main its build wrote. The pin of the first kind is fetched at deploy time, apart
from the demo's own install, so nothing else keeps it in step with the release the demo was built and
tested against.

This rule reads each `service('<name>', { start: '...' })` call and finds the project whose
`project.json` declares `metadata.deploy` with `provider: "railway"` and that `service`. For a service
that serves through a pin, it then reads the project's `package-lock.json`: the
`node_modules/@hyperfrontend/features` entry must be resolved from `https://registry.npmjs.org/`, and
the pin must equal its `version`. A lock is the offline proof that a release is published, so the rule
never points a service at a version that is only in the workspace's sources.

It also reports a service that no project deploys to, and a project deploying to a Railway service the
file does not declare.

The pin mismatch is fixable: `--fix` writes the version the lock installs.

A project whose `metadata.deploy.kind` is `service` is judged by its start command instead of a pin:
see [Built services](#built-services).

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

## Built services

A project whose `metadata.deploy` states `kind: "service"` is deployed as a built service: one
CommonJS main with every package inlined, so there is no pin to check. The project must state
`"kind": "service"` in `metadata.deploy`: without it, its service is held to the pin. The rule reads
the project's `build` target, which is the target a deploy follows, and requires its `executor` to be
`@hyperfrontend/workspace:service`. It takes the target's `options.outputPath` when that is a string
and `dist/<project root>` otherwise, and requires `start` to be exactly `node <output>/main.cjs`. The
path is written in double quotes, `node "<output>/main.cjs"`, when it holds a character other than
letters, digits and `_ @ % + = : , . / -`, a space for example, so that a shell passes it on whole.

The rule reads the `build` target as the task runner resolves it:

- The defaults of `hf.json` are merged in, so an executor or an `outputPath` that a default gives the
  target counts as if `project.json` stated it.
- The tokens of `outputPath` are replaced: `dist/{projectRoot}` is read as `dist/apps/hello` for the
  project at `apps/hello`.
- Only the target named `build` is judged. A project with no `build` target, or whose `build` runs
  another executor, is reported, whatever its other targets run.
- A workspace configuration the task runner refuses, an `hf.json` that is not JSON for example, counts
  as no `build` target.

`start` is the last `start` property of the options, as JavaScript takes it, whether its key is
written bare or quoted. An assertion around the value, such as `as const`, is read through. A spread
or a computed key such as `[key]` after that property, or in options that state no `start`, could
override the command, so the rule reports it. A computed `['start']` is read as `start`.

A wrong start command is fixable when it is a string literal: `--fix` writes the command.

The examples read this `apps/hello/project.json`:

```json
{
  "name": "hello",
  "targets": {
    "build": { "executor": "@hyperfrontend/workspace:service" }
  },
  "metadata": {
    "deploy": {
      "provider": "railway",
      "service": "hello",
      "kind": "service"
    }
  }
}
```

### ❌ Incorrect (built service)

A start command that puts `npx` between the platform and the process:

```typescript
const hello = service('hello', { start: 'npx node dist/apps/hello/main.cjs' })
```

**Error**: `Service 'hello' must start with 'node dist/apps/hello/main.cjs': a built service runs the main its build wrote, with nothing between the platform's signal and the process.`

### ✅ Correct (built service)

```typescript
const hello = service('hello', { start: 'node dist/apps/hello/main.cjs' })
```

## When Not To Use It

- Services that neither serve through `@hyperfrontend/features` nor run a built service

## Related Rules

- [deploy-static-headers](./deploy-static-headers.md)
- [project-lifecycle-policy](./project-lifecycle-policy.md)
