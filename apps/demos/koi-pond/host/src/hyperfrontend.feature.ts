/**
 * Host integration for the "@hyperfrontend/demo-koi-pond" feature.
 *
 * The pond is a host to eight koi and a hostee to whatever gallery mounts it,
 * and this is where the second of those is wired. The gallery hears how much of
 * the shoal is connected and when a disturbance sequence has unwound; it can
 * ask for a card-sized scene or strike the water without a pointer. When a
 * visitor asks to leave — the dialog ✕ or the Escape key — the pond emits a
 * close-request; the gallery owns the presentation and answers with set-scene,
 * which re-arms the next request.
 *
 * Opened directly in a tab nothing announces anything: the SDK creates no
 * channel, `send` is a no-op, and the pond simply runs as a standalone scene.
 *
 * @module @hyperfrontend/demo-koi-pond.feature
 */
import { createFeature } from '@hyperfrontend/features/hostee'
import contract from '../koi-pond.contract'
import { createPondReporter, wirePondContract, wireSceneBoot } from './feature/wire-contract'
import { mountDialogCloseControls } from './components/dialog-close-controls'
import { mountInteractionsToggle } from './components/interactions-toggle'
import { mountVitals, vitalsRequested } from './components/vitals'
import { wireEscapeClose } from './components/escape-close'
import { createPond } from './scene/pond'
import { featureUi } from './state/feature-ui'

/**
 * Looks up a required element, failing loudly when the markup drifts.
 *
 * @param selector - The CSS selector to resolve.
 * @returns The matching element.
 */
function el<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) {
    throw new Error(`missing element: ${selector}`)
  }
  return found
}

// ref: [guide:compose-independent-features/outer-boundary] start
/** The @hyperfrontend/demo-koi-pond feature handle; use it to send and receive contract actions. */
export const feature = createFeature({
  name: '@hyperfrontend/demo-koi-pond',
  contract,
  protocol: 'v1',
})
// ref: [guide:compose-independent-features/outer-boundary] end

const reporter = createPondReporter(feature)
const root = el<HTMLElement>('#pond')

// why: The overlay exists only when a visitor asked for it — a scene under diagnosis on a real device needs its evidence recorded on the device, and every other visitor pays nothing.
const vitals = vitalsRequested(window.location.search) ? mountVitals(root) : null

const scene = createPond(root, {
  onShoal: (connected, expected) => reporter.shoal(connected, expected),
  onSequenceComplete: (fish) => reporter.sequenceComplete(fish),
  ...(vitals !== null && { onDiagnostic: vitals.record }),
})

wirePondContract(feature, scene)

// why: The pond decides its scene before opening anything: a direct visit opens the full profile in this same tick, a hosted pond holds its water until the host says what it mounted.
wireSceneBoot(feature, scene, { hosted: feature.hosted })

if (vitals !== null) {
  // why: A pond under diagnosis is driven from the console — growing, shrinking, and reading the shoal on the very device whose evidence is being taken — so the armed overlay hands the session the scene handle.
  ;(<{ koiPond?: typeof scene }>(<unknown>window)).koiPond = scene
}

// why: The dialog chrome keys off the host's presentation announcements — never off URLs or frame ancestry.
featureUi.attach(feature)
mountDialogCloseControls(root, featureUi)

// why: Focus lives in this document once a visitor clicks the pond, so the host page never hears the key itself — the pond relays it as a close-request.
wireEscapeClose(window, featureUi, () => scene.releaseHeld())

// why: The gallery answers a close-request with set-scene rather than a fresh presentation — that acknowledgement is what re-arms the next request.
feature.on('set-scene', () => {
  featureUi.rearmClose()
})

mountInteractionsToggle(root, (on) => {
  scene.setInteractions(on)
})
