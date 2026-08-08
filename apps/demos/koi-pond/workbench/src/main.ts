/**
 * The koi model workbench.
 *
 * One command, one koi, one page. Everything on screen exists to answer one
 * question — does this fish look right — so the layout is a stage and a column
 * of knobs, and the only chrome is the readout that says what the fish costs.
 *
 * The koi comes straight out of `apps/demos/koi-pond/lib`'s TypeScript sources
 * rather than its packed tarball, so editing a mesh generator hot-reloads here
 * without a rebuild.
 */
import type { WorkbenchState } from './controls'
import { NO_DEBUG } from '@hyperfrontend/demo-koi-lib/three'
import { buildControlGroups } from './controls'
import { createControlPanel } from './panel'
import { createViewport } from './viewport'
import './styles/workbench.css'

const root = document.querySelector<HTMLElement>('#app')
if (root === null) {
  throw new Error('the workbench needs an #app element to mount into')
}

const stage = document.createElement('div')
stage.className = 'wb-stage'
const readout = document.createElement('div')
readout.className = 'wb-metrics'
stage.append(readout)
root.append(stage)

const viewport = createViewport(stage)

const state: WorkbenchState = {
  cameraMode: 'production',
  tilt: 22,
  swing: 10,
  distance: 2.55,
  backdrop: 'slate',
  lighting: 'development',
  preset: 'Relaxed swim',
  scrub: 0,
  debug: { ...NO_DEBUG },
  depth: { scale: 0.72, fade: 0.42, dim: 0.66, tint: '#2b4a55' },
}

viewport.koi.setMotion({ speed: 0.55 })
viewport.koi.setDepthResponse(state.depth)

const panel = createControlPanel(buildControlGroups(viewport, state, () => panel.refresh()))
root.append(panel.element)

// why: The readout is polled rather than pushed because it reports what the renderer measured, and the renderer only knows after it has drawn.
window.setInterval(() => {
  const metrics = viewport.metrics
  readout.textContent = [
    `${metrics.fps} fps`,
    `${metrics.triangles.toLocaleString()} tris`,
    `${metrics.vertices.toLocaleString()} verts`,
    `${metrics.drawCalls} draws`,
    metrics.memory,
    `pose ${metrics.updateMs.toFixed(2)} ms`,
  ].join('  ·  ')
}, 250)

// how: The production view is one keystroke away at every moment, because the orbit camera is only ever a detour.
window.addEventListener('keydown', (event) => {
  if (event.key === 'r' || event.key === 'R') {
    state.cameraMode = 'production'
    viewport.setCameraMode('production')
    viewport.resetCamera()
    panel.refresh()
  }
  if (event.key === ' ') {
    event.preventDefault()
    viewport.setRunning(!viewport.running)
    panel.refresh()
  }
})
