# require-node-protocol

Require the `node:` prefix on imports of Node built-in modules.

## Rule Details

The `node:` prefix names a built-in unambiguously: a reader tells it from an npm package at a glance, and a package published under the same name can never shadow it. The rule reports an import whose source is a Node built-in written without the prefix, judged by its first path segment against the running Node's list of built-ins, so `fs/promises` counts as well as `fs`. The fix adds the prefix, keeping the quote style.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
import { readFileSync } from 'fs'
import path from 'path'
import { setTimeout } from 'timers/promises'
```

### ✅ Correct

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import express from 'express'
```

## When Not To Use It

When the code must run on a Node too old for the prefix (before 14.18 for `require()`, before 12.20 for ES modules).

## Limitations

Only import declarations are read. `require()` calls, dynamic `import()` expressions and re-exports (`export * from 'fs'`) are not reported.
