# generators

Pure code generators that turn a resolved feature config and its parsed contract into staged output files. Each generator is a pure `(config, contract, tree) => void` that writes into a `@hyperfrontend/project-scope` VFS `Tree` and does no I/O of its own — all discovery, prompting, temp-dir lifecycle, and `commitChanges` belong to the CLI.

## API

| Export                  | Purpose                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `generateShell`         | Stages the self-contained host connector package (entry, `package.json`, README, metadata). |
| `generateMetadata`      | Stages the connector's `metadata.json` with a version-stamped, embedded contract.           |
| `generateFeatureModule` | Stages the write-once feature integration module (`src/hyperfrontend.feature.ts`).          |
| `generateContractTypes` | Bridges a `.json` contract to a sibling `.d.ts` of literal-type unions.                     |

## Usage

```typescript
import { createTree } from '@hyperfrontend/project-scope/vfs'
import { generateShell } from '@hyperfrontend/features/generators'

const tree = createTree('/tmp/clock-shell')
generateShell({ name: 'clock', version: '1.0.0', contract: './clock.contract.json', url: '/clock' }, contract, tree)
```
