# locked-prop-descriptors

Property descriptor builder for non-writable, non-configurable property definitions.

## Overview

`lockedPropertyDescriptors()` returns a descriptor map suitable for `Object.defineProperties` that locks every property as both non-writable and non-configurable, while leaving enumeration controllable per-property. Use it when you need `Object.defineProperties`-style bulk application but want the safety profile of `locked-props` — for example, when freezing a class prototype, an exported namespace object, or the public surface of a factory result.

## Usage

```typescript
import { lockedPropertyDescriptors } from '@hyperfrontend/immutable-api-utils/locked-prop-descriptors'

const descriptors = lockedPropertyDescriptors({
  name: 'service',
  version: '1.0.0',
  build: () => ({}),
})

const surface = Object.defineProperties({}, descriptors)
surface.name = 'spoofed' // TypeError in strict mode
```

## When to use

Pick `locked-prop-descriptors/` when you want full control over how the descriptors are applied (custom target object, mixing with non-locked descriptors, mass-defining on a prototype). For the more common case of locking properties on an object you already have, `locked-props/` is the higher-level shortcut.
