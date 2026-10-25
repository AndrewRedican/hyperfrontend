# How to test a package the way a consumer installs it

You will prove, inside your existing suite, that the tarball you are about to publish installs on its own, that every entry in its exports map loads under plain Node with `import` and with `require`, and that the package does what it says when a consumer calls it. When the proof fails, the failure names the entry or the call, with the child process's own error attached.

A library's unit tests run where the workspace does the resolving: a path alias points `my-lib/node` at a source file, a loader hook completes the extension a published file would need, and a hoisted `node_modules` supplies whatever a bundled dependency forgot to carry. A tarball has none of that. The defects that get through are the ones that only show once a consumer runs `npm install`: an exports subpath that points at a file the build never wrote, a CommonJS twin that `require` cannot load, a chunk two entries share that one of them imports by a path that no longer exists. [`@hyperfrontend/testing`](/docs/libraries/testing) ships the [`/consumer`](/docs/libraries/testing/consumer) entry for this: it installs the packed tarball into a directory outside the workspace and drives it through child processes that know nothing about where the source lives.

The examples use a library called `my-lib` with a root entry and a `./node` subpath; replace the names with your own.

## 1. Pack the build and hand the suite its path

Run `npm pack` in the directory your build writes, the one with the published `package.json` in it, and keep the path of the `.tgz` it prints. The suite reads that path from an environment variable, so the same spec serves a local run and CI:

```sh
cd dist/my-lib && npm pack && cd -
MY_LIB_TARBALL="$PWD/dist/my-lib/my-lib-1.0.0.tgz" node --test
```

If a build step of yours already packs the package, pass its output instead; the suite only needs an absolute path to a tarball `npm install` accepts.

## 2. Install it once for the suite

[`usePackedConsumer`](/docs/libraries/testing/consumer#api-usePackedConsumer) registers the `node:test` hooks that install the tarball before the suite's first test and delete the directory after its last. Call it at the top of the spec and keep the handle:

```ts
import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.MY_LIB_TARBALL })
```

The install runs `npm install` with `--prefer-offline` in a fresh directory under the system temporary directory, so it reuses the npm cache and finishes in a few seconds. The handle forwards to that directory for as long as the suite runs; reading it outside a test or hook throws, which is how a misplaced call announces itself. For a consumer a single test owns, [`createPackedConsumer`](/docs/libraries/testing/consumer#api-createPackedConsumer) installs straight away and leaves removal to you.

## 3. Load every entry under plain Node

[`entries`](/docs/libraries/testing/consumer#api-PackedConsumer) reads the installed manifest's exports map and loads each subpath in a child process of its own, with `import` or `require` as the map allows for it. Each [`EntryLoad`](/docs/libraries/testing/consumer#api-EntryLoad) says whether the load succeeded and carries the first lines of the child's error when it did not, so the assertion is on the list of failures:

```ts
describe('my-lib as a consumer sees it', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })
})
```

Keep the two module systems in separate tests. A dual package can break on one side only, and the report then names which.

## 4. Call the package from a child

[`run`](/docs/libraries/testing/consumer#api-PackedConsumer) takes a function, serialises it with `toString()`, writes it into a script inside the consumer and runs that script with the Node binary running the suite. The function therefore executes where the package is installed and can close over nothing from the spec: import the package inside the body, and hand it values through [`args`](/docs/libraries/testing/consumer#api-RunOptions), which travel as JSON, as the result does.

```ts
it('hashes through the node entry', () => {
  const hash = consumer.run(async () => {
    const { createHash } = await import('my-lib/node')
    return createHash('abc')
  })
  expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

it('hashes the same bytes through the CommonJS build', () => {
  const hash = consumer.run((args: { text: string }) => require('my-lib/node').createHash(args.text), {
    kind: 'require',
    args: { text: 'abc' },
  })
  expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
```

A child that exits non-zero makes `run` throw with everything the child wrote to stderr, so a call that fails inside the package fails the test with the package's own stack. Return plain data from the body; a function, a class instance or a `Map` does not survive the JSON trip, so reduce it to the facts the assertion needs before returning.

Make the body cross something a consumer's resolution has to get right: a subpath entry, a chunk two entries share, a dependency the build bundled. A call that only touches the root entry proves less than the entries test already did.

## 5. Bring the peers a consumer brings

A package that declares an optional peer dependency expects the consumer to install it. Name it in [`peers`](/docs/libraries/testing/consumer#api-PackedConsumerOptions), pinned the way your own project pins it, and the entry that loads the peer resolves exactly as it would for that consumer:

```ts
const consumer = usePackedConsumer({ tarball: process.env.MY_LIB_TARBALL, peers: ['jsdom@26.1.0'] })
```

Leave the peer out and the entries test reports the entry that needs it, which is the behaviour a consumer who forgot the peer would see.

## 6. Check the oldest Node release you declare

The suite itself runs on Node 22.18 or later, since that is the floor of [`@hyperfrontend/testing`](/docs/libraries/testing). The children need not. Point [`node`](/docs/libraries/testing/consumer#api-PackedConsumerOptions) at the binary of the oldest release your `engines` field declares, and every entry load and every `run` executes on it:

```ts
const consumer = usePackedConsumer({ tarball: process.env.MY_LIB_TARBALL, node: process.env.MY_LIB_FLOOR_NODE })
```

`npx -y -p node@18 node -p process.execPath` prints the path of a Node 18 binary npm has fetched, which is a convenient value for that variable in a CI job. A package that reads a global the floor release lacks fails here with the child's `ReferenceError`, where the same call under the suite's own Node would have passed.

## Check it worked

Break the package on purpose and watch the right test name it. Point one subpath of the exports map at a file that does not exist and pack again: the entries test fails with that specifier and the child's `ERR_MODULE_NOT_FOUND`, while the other entries still report `ok: true`. Then make a function throw on its first call: the `run` test fails with the message and stack from inside the installed package, not from the spec. Both failures come from a directory that contains the tarball and nothing of your workspace, which is the difference between testing the source and testing what you are about to ship.
