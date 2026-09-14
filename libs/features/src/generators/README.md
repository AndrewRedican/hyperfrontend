# generators

Pure code generators that turn a resolved feature config and parsed contract into staged output files.

## API

| Export                                                                                                                 | Purpose                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`generateShell`](https://www.hyperfrontend.dev/docs/libraries/features/generators/#api-generateShell)                 | Stages the self-contained shell package (entry, `package.json`, README, metadata); composes only the feature's declared display modes and narrows the generated types to them. |
| [`generateMetadata`](https://www.hyperfrontend.dev/docs/libraries/features/generators/#api-generateMetadata)           | Stages the shell's `metadata.json` with a version-stamped, embedded contract and the declared display modes.                                                                   |
| [`generateFeatureModule`](https://www.hyperfrontend.dev/docs/libraries/features/generators/#api-generateFeatureModule) | Stages the feature integration module (`src/hyperfrontend.feature.ts`); regenerates it only while pristine and never clobbers author edits.                                    |
| [`generateContractTypes`](https://www.hyperfrontend.dev/docs/libraries/features/generators/#api-generateContractTypes) | Bridges a `.json` contract to a sibling `.d.ts` of literal-type unions.                                                                                                        |

## Usage

```typescript
import { createTree } from '@hyperfrontend/project-scope/vfs'
import { generateShell } from '@hyperfrontend/features/generators'

const tree = createTree('/tmp/clock-shell')
generateShell(
  {
    name: 'clock',
    version: '1.0.0',
    contract: './clock.contract.json',
    url: '/clock',
  },
  contract,
  tree
)
```
