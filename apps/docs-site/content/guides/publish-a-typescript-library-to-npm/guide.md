# Publish a TypeScript library to npm

You will turn a directory holding one TypeScript file into a package that imports, requires, and type-checks correctly wherever it is installed, without hand-writing an exports map or wiring two bundlers together.

Everything comes from [`@hyperfrontend/builder`](/docs/libraries/builder). It drives declaration emit through your own TypeScript, so both arrive as dev dependencies.

## Set up the project

Three files, none of them about the builder. In a new directory called `bytesize`, `package.json` carries the facts only you know:

```json
{
  "name": "bytesize",
  "version": "1.0.0",
  "description": "Format byte counts as human-readable strings.",
  "license": "MIT",
  "keywords": ["bytes", "format"]
}
```

`src/index.ts` is the library:

```ts
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/**
 * Formats a byte count as a human-readable string.
 */
export function formatBytes(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${Math.round(value * 10) / 10} ${UNITS[unit]}`
}
```

And `tsconfig.json`, where [`rootDir`](https://www.typescriptlang.org/tsconfig/#rootDir) is the one setting worth attention: it names `src` as the base of the tree, so the emitted `.d.ts` lands beside the bundles instead of inside a `src/` folder nobody imports from.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Then install the toolchain:

```bash
npm install --save-dev @hyperfrontend/builder typescript
```

## Describe the build

Create `builder.config.json`. Every key is a field of [`BuildConfig`](/docs/libraries/builder/models#api-BuildConfig):

```json
{
  "projectRoot": ".",
  "workspaceRoot": ".",
  "outputPath": "dist/bytesize",
  "tsConfig": "tsconfig.json",
  "esm": {},
  "cjs": {}
}
```

`esm` and `cjs` are empty on purpose. Naming a format asks for it; its contents tune it. Leave one out and that format is not built.

## Run it

```bash
npx hf-build --config ./builder.config.json
```

A successful build is quiet. Pass `--verbose` to watch each phase report its progress, timing, and memory. What landed:

```text
dist/bytesize/
  index.cjs.js
  index.esm.js
  index.d.ts
  index.d.ts.map
  package.json
```

One source file, both module formats, and declarations, out of a config that named none of them.

## Read the manifest it wrote

Open `dist/bytesize/package.json`:

```json
{
  "name": "bytesize",
  "version": "1.0.0",
  "description": "Format byte counts as human-readable strings.",
  "license": "MIT",
  "keywords": ["bytes", "format"],
  "devDependencies": {
    "@hyperfrontend/builder": "^0.2.0",
    "typescript": "^7.0.2"
  },
  "sideEffects": false,
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types": "./index.d.ts",
      "import": "./index.esm.js",
      "require": "./index.cjs.js"
    }
  },
  "main": "./index.cjs.js",
  "module": "./index.esm.js",
  "types": "./index.d.ts",
  "files": ["**/index.*", "**/index.d.ts", "!**/*.js.map"]
}
```

What you wrote came through as written. Everything from `sideEffects` down is synthesized from what the build actually emitted: the [`exports`](https://nodejs.org/api/packages.html#exports) map points each condition at the file that satisfies it, `main`, `module` and `types` repeat that for tooling older than `exports`, and `files` reflects the emitted tree rather than a list you have to remember to update. Add an entry point later and this manifest grows to match on the next build.

## Prove both module systems

The output directory is the package, so pack that directory rather than the project root:

```bash
npm pack ./dist/bytesize
```

Then install the tarball into a directory that knows nothing about the project, and load it each way:

```bash
mkdir ../bytesize-check && cd ../bytesize-check
npm install ../bytesize/bytesize-1.0.0.tgz
node --input-type=module -e "import { formatBytes } from 'bytesize'; console.log(formatBytes(1536))"
node --input-type=commonjs -e "const { formatBytes } = require('bytesize'); console.log(formatBytes(5368709120))"
```

```text
1.5 KB
5 GB
```

The named export resolves under `import`, the same name destructures out of `require`, and `tsc` follows the `types` condition to `index.d.ts`, so `formatBytes('2048')` is a compile error in the consumer rather than a runtime surprise.

## Publish

Point [`npm publish`](https://docs.npmjs.com/cli/commands/npm-publish) at the same directory. The source root is not the package and must never be the thing you publish:

```bash
npm publish ./dist/bytesize
```

## What you have

A package whose consumers get ESM, CJS, and types from one source file, described by a six-line config. The shape worth carrying forward is that split: you state the facts about the package, the build states what it produced, and no manifest has to be kept in agreement with a bundler by hand.
