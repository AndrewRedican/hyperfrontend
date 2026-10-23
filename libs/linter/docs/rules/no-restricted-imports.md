# no-restricted-imports

Forbid importing modules, or names from modules, that the configuration restricts.

## Rule Details

Some modules should not be used in some places: a heavy library with a lighter alternative, a package's internals, a server module in browser code. The rule matches the source of every import, re-export (`export ... from`, `export * from`) and TypeScript `import x = require(...)` against the configured patterns and reports what they restrict. A pattern restricts the whole module, or only some of the names imported from it, or every name except an allowed few. With no patterns configured the rule reports nothing. The rule does not fix.

Patterns are gitignore-style and matched case-insensitively against the module source split at `/`: `*` matches within one segment, `?` one character, `**` any number of segments. A pattern with no slash, or one starting with `**/`, matches at any depth; one with a slash is anchored at the start. A pattern matches a path and everything under it, so a pattern naming lodash also matches `lodash/fp`. A pattern starting with `!` excepts the paths it matches; the last matching pattern of a group wins.

Reimplements [ESLint's `no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports), in its [`patterns`](#options) object form.

## Options

| Option                 | Type       | Default | Meaning                                               |
| ---------------------- | ---------- | ------- | ----------------------------------------------------- |
| [`patterns`](#options) | `object[]` | `[]`    | The restrictions, each an object of the fields below. |

| Field                          | Type       | Meaning                                                                                    |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------------------ |
| [`group`](#options)            | `string[]` | Required. The patterns a module source is matched against.                                 |
| [`importNames`](#options)      | `string[]` | Only these names are restricted; `default` and `*` name the default and namespace imports. |
| [`allowImportNames`](#options) | `string[]` | Every name except these is restricted.                                                     |
| [`message`](#options)          | `string`   | Text appended to the report, such as the alternative to use.                               |

Of the original's options only the object form of [`patterns`](#options) with these four fields is read. The [`paths`](https://eslint.org/docs/latest/rules/no-restricted-imports#paths) option, string entries in [`patterns`](#options), and the [`regex`, `caseSensitive`, `importNamePattern`, `allowImportNamePattern` and `allowTypeImports`](https://eslint.org/docs/latest/rules/no-restricted-imports#options) fields are not supported.

## Examples

### ❌ Incorrect, with a restricted module

<!-- options: {"patterns": [{"group": ["lodash"], "message": "Use lodash-es."}]} -->

```ts
import merge from 'lodash/merge'
export * from 'lodash'
```

### ❌ Incorrect, with restricted names

<!-- options: {"patterns": [{"group": ["react"], "importNames": ["default"]}]} -->

```ts
import React from 'react'
```

### ✅ Correct, with a restricted module

<!-- options: {"patterns": [{"group": ["lodash", "!lodash/fp"]}]} -->

```ts
import { merge } from 'lodash-es'
import flow from 'lodash/fp'
```

### ✅ Correct, with restricted names

<!-- options: {"patterns": [{"group": ["react"], "importNames": ["default"]}]} -->

```ts
import { useState } from 'react'
```
