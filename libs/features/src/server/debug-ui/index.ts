/* eslint-disable workspace/no-unwanted-barrel-files -- build entry discovery requires an index.ts; this debug-UI page entry is compiled to an IIFE served by the dev server, not a package export */
import type { DevManifest } from '../dev-server'
import { mountDebugUi } from './app'

/** The page window with the server-injected manifest attached. */
interface DebugWindow {
  /** Manifest the control server inlines into the page before this script runs. */
  readonly __HF_DEBUG_MANIFEST__?: DevManifest
}

// note: Page entry — reads the server-injected manifest and mounts the debug UI. Excluded from coverage as a thin DOM bootstrap; its rendering is covered by app.browser.spec.ts.
const root = document.getElementById('hf-debug-root')
const manifest = (<DebugWindow>(<unknown>window)).__HF_DEBUG_MANIFEST__

if (root !== null && manifest !== undefined) {
  mountDebugUi(root, manifest)
}
