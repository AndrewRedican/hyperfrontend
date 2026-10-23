# package-json/restrict-dependency-ranges

Require the dependency versions of a `package.json` to use the range types the configuration allows.

## Rule Details

Whether a project pins its dependencies, takes caret ranges or takes tilde ranges is a policy, and a manifest that mixes them updates some packages further than intended. The rule reads the [`dependencies`](https://docs.npmjs.com/cli/configuring-npm/package-json#dependencies), [`devDependencies`](https://docs.npmjs.com/cli/configuring-npm/package-json#devdependencies), [`peerDependencies`](https://docs.npmjs.com/cli/configuring-npm/package-json#peerdependencies) and [`optionalDependencies`](https://docs.npmjs.com/cli/configuring-npm/package-json#optionaldependencies) of a `package.json` and reports a version whose range type is not allowed for its section: a pin is an exact version such as `1.2.3`, a caret range starts with `^`, a tilde range with `~`. The `workspace:` protocol is understood, with `workspace:*` counted as a pin. A bare `*` is always reported. Versions the rule cannot read as a range, such as tags, URLs, `file:` or `npm:` aliases, are skipped. With no options the rule reports nothing.

Each report carries one suggestion per allowed range type that rewrites the version, such as `>=1.2.3` to `^1.2.3`. Suggestions appear in the JSON report and are never applied by `--fix`; the rule does not fix.

Reimplements [eslint-plugin-package-json's `restrict-dependency-ranges`](https://github.com/JoshuaKGoldberg/eslint-plugin-package-json/blob/main/docs/rules/restrict-dependency-ranges.md).

## Options

The options are one restriction object, or an array of them. For each dependency the last restriction in the array whose sections include the dependency's section applies.

| Option                           | Type                   | Default      | Meaning                                                                  |
| -------------------------------- | ---------------------- | ------------ | ------------------------------------------------------------------------ |
| [`rangeType`](#options)          | `string` or `string[]` | required     | The allowed range type or types: `"pin"`, `"caret"` or `"tilde"`.        |
| [`forDependencyTypes`](#options) | `string[]`             | all sections | The sections the restriction applies to, such as `["peerDependencies"]`. |

The original's [`forPackages` and `forVersions`](https://github.com/JoshuaKGoldberg/eslint-plugin-package-json/blob/main/docs/rules/restrict-dependency-ranges.md#options) filters are not read.

## Examples

### ❌ Incorrect, with { "rangeType": "pin" }

<!-- options: {"rangeType": "pin"} -->

```json
{
  "name": "example",
  "dependencies": { "react": "^19.0.0", "lodash": "*" }
}
```

### ❌ Incorrect, with pinned dependencies and caret peers

<!-- options: [{"rangeType": "pin"}, {"forDependencyTypes": ["peerDependencies"], "rangeType": "caret"}] -->

```json
{
  "name": "example",
  "peerDependencies": { "react": "19.0.0" }
}
```

### ✅ Correct, with { "rangeType": "pin" }

<!-- options: {"rangeType": "pin"} -->

```json
{
  "name": "example",
  "dependencies": { "react": "19.0.0", "shared": "workspace:*" },
  "devDependencies": { "fixtures": "file:../fixtures" }
}
```

### ✅ Correct, with pinned dependencies and caret peers

<!-- options: [{"rangeType": "pin"}, {"forDependencyTypes": ["peerDependencies"], "rangeType": "caret"}] -->

```json
{
  "name": "example",
  "dependencies": { "react": "19.0.0" },
  "peerDependencies": { "react": "^19.0.0" }
}
```
