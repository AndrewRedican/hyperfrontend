# locked-props

A functional helper that locks an arbitrary set of object properties in a single call, marking each as non-writable and non-configurable.

## Overview

`lockedProps()` accepts an object and a description of which properties to lock (and with what values). It applies the resulting descriptors via `Object.defineProperty`, so writes throw in strict mode and the descriptors themselves cannot be later reconfigured. Use it for partial-immutability cases that fall outside the class-method shape `@locked()` targets — config snapshots, frozen API surfaces, factory outputs, etc.

## Usage

```typescript
import { lockedProps } from '@hyperfrontend/immutable-api-utils/locked-props'

const config = lockedProps(
  {},
  {
    apiUrl: 'https://example.com',
    version: 1,
    region: 'us-east-1',
  }
)

config.apiUrl = 'https://attacker.example' // TypeError in strict mode
delete config.version // TypeError in strict mode
```

## When to use

Pick `lockedProps()` over `Object.freeze()` when only some properties should be immutable, or when descriptor-level guarantees (no reconfiguration, no deletion) matter beyond shallow value freezing. For class-method binding, prefer the `@locked()` decorator.
