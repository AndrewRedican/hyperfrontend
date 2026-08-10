/**
 * Shell-packaging entry for the "@hyperfrontend/demo-koi-fish-react" feature's contract.
 *
 * The koi contract's single source of truth lives in the shared koi library;
 * this file re-exports it so the shell build bakes the very object the running
 * app wires in `src/hyperfrontend.feature.ts` — the generated package and the
 * running feature can never disagree about the wire.
 */
import { koiFishContract } from '@hyperfrontend/demo-koi-lib/contract'

export default koiFishContract
