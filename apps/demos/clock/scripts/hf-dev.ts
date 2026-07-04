// note: Works around SDK v0.1.0 dev-loop gaps: hf dev exits (killing its servers), the
// ESM dev server cannot self-locate assets, and the debug UI is missing from
// the published package. Uses the programmatic API to keep the process alive and
// serves the hand-rolled host page in dev-host/ as the debug UI via `assetRoot`.
import { copyFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDevConfig, startDevServer } from '@hyperfrontend/features/server'

const devHostDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dev-host')

const packageRoot = dirname(createRequire(import.meta.url).resolve('@hyperfrontend/features/package.json'))
copyFileSync(join(packageRoot, 'bundle', 'host', 'index.iife.js'), join(devHostDir, 'host-bundle.js'))

const config = await resolveDevConfig({
  cwd: process.cwd(),
  flags: { ci: false, yes: false, dryRun: false, help: false },
})
const handle = await startDevServer(config, { assetRoot: devHostDir })
for (const app of handle.apps) {
  console.log(`  ${app.name} → ${app.url}`)
}
if (handle.debugUrl !== undefined) {
  console.log(`Dev host (debug UI stand-in): ${handle.debugUrl}`)
}
