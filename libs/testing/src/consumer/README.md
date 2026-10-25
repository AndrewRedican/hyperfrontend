# consumer

A packed package installed outside the workspace and driven through plain Node child processes, so a suite checks what a consumer installs rather than what the workspace resolves.

## Usage

[`usePackedConsumer`](https://www.hyperfrontend.dev/docs/libraries/testing/consumer/#api-usePackedConsumer) registers the `node:test` hooks that install the tarball once for the suite and delete the directory afterwards. The handle it returns always points at the suite's consumer, so capture it once at the top of the spec or in the [`describe`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-describe) body:

```typescript
import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.MY_LIB_TARBALL })

describe('my-lib as a consumer sees it', () => {
  it('imports every export entry under plain Node', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('hashes through the node entry', () => {
    const hash = consumer.run(async () => {
      const { createHash } = await import('my-lib/node')
      return createHash('abc')
    })
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
```

[`entries`](https://www.hyperfrontend.dev/docs/libraries/testing/consumer/#api-PackedConsumer) reads the installed manifest's `exports` map and loads each subpath in a child process of its own, with `import` or `require` as the map allows, so an entry that resolves only through a bundler, a path alias or a loader hook fails here with the child's error attached.

[`run`](https://www.hyperfrontend.dev/docs/libraries/testing/consumer/#api-PackedConsumer) serialises the function it is given with `toString()`, writes it into a script inside the consumer and runs that script with the Node binary running the suite. The function therefore closes over nothing from the spec: import the package inside the body and pass values through [`args`](https://www.hyperfrontend.dev/docs/libraries/testing/consumer/#api-RunOptions), which travel as JSON, as the result does. Pass `kind: 'require'` to run the body as CommonJS. A child that exits non-zero makes [`run`](https://www.hyperfrontend.dev/docs/libraries/testing/consumer/#api-PackedConsumer) throw with everything the child wrote to stderr.

[`write`](https://www.hyperfrontend.dev/docs/libraries/testing/consumer/#api-PackedConsumer) and [`node`](https://www.hyperfrontend.dev/docs/libraries/testing/consumer/#api-PackedConsumer) are the pieces underneath, for a script that is more than one function, such as a build driven by the installed package. [`peers`](https://www.hyperfrontend.dev/docs/libraries/testing/consumer/#api-PackedConsumerOptions) installs the packages a consumer is expected to bring, such as an optional peer dependency. [`node`](https://www.hyperfrontend.dev/docs/libraries/testing/consumer/#api-PackedConsumerOptions) points the children at another Node binary, so a suite running on a current release can check the package on the oldest one it declares. For a consumer one test owns, [`createPackedConsumer`](https://www.hyperfrontend.dev/docs/libraries/testing/consumer/#api-createPackedConsumer) installs straight away and leaves removal to the caller.

## Design

The install uses the npm cache the suite's own project install just filled, so it is fast and works offline; the consumer directory sits under the system temporary directory, outside any workspace, with nothing installed above it to fall back on. The result of [`run`](https://www.hyperfrontend.dev/docs/libraries/testing/consumer/#api-PackedConsumer) goes to a file rather than stdout so whatever the package prints cannot corrupt it.
