# How to read another tool's config file

You will read a project's TypeScript, bundler, or environment configuration from your own tool, without hardcoding the seven names each of those files can have and without shipping a JSON-with-comments parser to survive `tsconfig.json`.

Linters, generators, migration scripts, and CI checks all need this, and it is where they quietly go wrong: `JSON.parse` throws on a `tsconfig.json` that has a comment in it, `.eslintrc` alone has seven spellings, and half of these files are code rather than data. [`@hyperfrontend/project-scope`](/docs/libraries/project-scope) knows the patterns and the formats.

```bash
npm install @hyperfrontend/project-scope
```

## 1. Locate the file by tool, not by name

[`findConfigFile`](/docs/libraries/project-scope/project/config#api-findConfigFile) takes a directory and a [`ConfigType`](/docs/libraries/project-scope/project/config#api-ConfigType), tries that tool's known filenames in order, and returns the absolute path of the first one present or `null`:

```js
import { findConfigFile } from '@hyperfrontend/project-scope/project/config'

const tsconfigPath = findConfigFile(projectRoot, 'tsconfig')
if (!tsconfigPath) {
  console.error('no TypeScript configuration in this project')
  process.exit(1)
}
```

Every supported tool is a `ConfigType`, and [`CONFIG_PATTERNS`](/docs/libraries/project-scope/project/config#api-CONFIG_PATTERNS) is the table of what each one matches.

## 2. Read the values

[`parseConfig`](/docs/libraries/project-scope/project/config#api-parseConfig) infers the format from the type it recognised and returns a [`ParsedConfig`](/docs/libraries/project-scope/project/config#api-ParsedConfig). For a JSON, JSON-with-comments, or dotenv file the values arrive on `data`:

```js
import { parseConfig } from '@hyperfrontend/project-scope/project/config'

const config = parseConfig(tsconfigPath)

if (config.data.compilerOptions?.strict !== true) {
  console.warn(`${config.path}: strict mode is off`)
}
```

That works on the real `tsconfig.json` in front of you, comments and trailing commas included; `config.format` reports `jsonc` when it took that route. A path that does not exist throws, so let `findConfigFile` decide what exists.

## 3. Follow the extends chain

Configuration that inherits reports its parents on `extends`, already normalised to an array. Relative specifiers resolve against the file that named them, and bare ones resolve like any module:

```js
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const parents = (config.extends ?? []).map((specifier) =>
  specifier.startsWith('.') ? resolve(dirname(config.path), specifier) : createRequire(config.path).resolve(specifier)
)

for (const parent of parents) {
  const inherited = parseConfig(parent)
  // …merge inherited.data under config.data, nearest file wins
}
```

Parents parse the same way, so the same call walks the whole chain.

## 4. Hand the ones that are code to a loader

`vite.config.ts`, `eslint.config.js`, and everything like them cannot be read as data. Branch on `data`: when it is absent, `format` is `js` or `ts` and the source is on `raw`.

```js
import { pathToFileURL } from 'node:url'

const bundler = parseConfig(findConfigFile(projectRoot, 'vite'))

if (bundler.data) {
  applySettings(bundler.data)
} else {
  applySettings((await import(pathToFileURL(bundler.path))).default)
}
```

Reach for `raw` when you want to inspect the source without running it, for example to check whether a plugin is mentioned at all before doing anything more expensive.

## 5. Sweep a directory when you do not know what is there

[`detectConfigs`](/docs/libraries/project-scope/project/config#api-detectConfigs) returns a [`DetectedConfig`](/docs/libraries/project-scope/project/config#api-DetectedConfig) for every recognised file, with the path relative to the directory you passed. Its `info` carries the tool's description and the flags worth respecting, including `sensitive` on files that hold secrets:

```js
import { detectConfigs } from '@hyperfrontend/project-scope/project/config'

for (const found of detectConfigs(projectRoot)) {
  if (found.info.sensitive) continue
  console.log(found.type.padEnd(14), found.path)
}
```

```text
package.json   package.json
tsconfig       tsconfig.json
vite           vite.config.ts
eslint         .eslintrc.yml
```

Pass a list of types as the second argument to narrow the sweep to the tools you act on. Detection results are cached per directory, so call [`clearConfigDetectionCache`](/docs/libraries/project-scope/project/config#api-clearConfigDetectionCache) between the moment your tool writes a config file and the moment it scans that directory again.

## Check it worked

Point your tool at a project whose `tsconfig.json` carries comments and extends a shared base: it reads the settings instead of throwing, and names the base file as a parent. Ask for `'eslint'` in a project configured by `.eslintrc.yml`, then in one configured by `eslint.config.js`, and both come back without your code knowing the difference. Run the sweep over a directory holding a `.env` and the environment file is listed by the detector and skipped by your loop.
