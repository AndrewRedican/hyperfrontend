# locked

A TypeScript decorator that locks class methods so they cannot be reassigned and always retain their original `this` binding.

## Overview

The `@locked()` decorator stamps a method as non-writable, non-configurable, and per-instance bound. Once a method is decorated, attempting to overwrite it throws a `TypeError`, and references to the method (passed as callbacks, event handlers, or torn off the instance) keep a correct `this`. Bindings are cached per instance via a `Symbol` key, so the cost of `.bind(this)` is paid once per `(instance, method)` pair instead of on every access.

## Usage

```typescript
import { locked } from '@hyperfrontend/immutable-api-utils/locked'

class HttpClient {
  @locked()
  send(payload: object): Promise<Response> {
    return fetch('/api', { method: 'POST', body: JSON.stringify(payload) })
  }
}

const client = new HttpClient()

// Method reference keeps correct `this`
const send = client.send
send({ ping: true }) // works

// Reassignment is blocked
client.send = () => Promise.resolve(new Response('overridden'))
// => TypeError: Cannot assign to read only property 'send'
```

## When to use

Reach for `@locked()` when a class exposes methods to plugin systems, third-party code, or any boundary where reassignment or `this`-loss would be a real bug. For one-off property locking outside class contexts, prefer `locked-props/`.
