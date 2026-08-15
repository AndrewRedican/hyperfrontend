/**
 * Every knob the workbench offers, in the order you reach for them.
 *
 * The list is deliberately flat and mechanical: each control is a label, a
 * range, and a pair of accessors straight onto the koi. Adding one when the
 * model grows a parameter is a single line, and nothing here holds state of its
 * own — the koi is the only source of truth, so a preset that changes ten values
 * shows up on ten sliders without anything having to be told.
 */
import type { KoiDebugFlags, KoiDepthResponse, KoiLightingPreset } from '@hyperfrontend/demo-koi-lib/three'
import type { ControlGroup } from './panel'
import type { BackdropName, Viewport } from './viewport'
import { KOI_PATTERNS, MOTION_PRESETS } from '@hyperfrontend/demo-koi-lib'
import { KOI_LIGHTING_PRESETS } from '@hyperfrontend/demo-koi-lib/three'
import { BACKDROPS } from './viewport'

/** The workbench's own state, which the koi does not own. */
export interface WorkbenchState {
  /** Which camera is driving. */
  cameraMode: 'production' | 'orbit'
  /** How far off straight-down the production camera leans, in degrees. */
  tilt: number
  /** How far around the koi that lean is taken, in degrees. */
  swing: number
  /** Distance from the koi as a multiple of its length. */
  distance: number
  /** Which backdrop the koi is judged against. */
  backdrop: BackdropName
  /** Which light it is judged under. */
  lighting: KoiLightingPreset
  /** Which motion preset was last applied. */
  preset: string
  /** How far through the tail beat a frozen koi is posed, in turns. */
  scrub: number
  /** Which overlays are showing. */
  debug: KoiDebugFlags
  /** How the koi answers depth. */
  depth: KoiDepthResponse
}

/**
 * Builds every control group.
 *
 * @param viewport - The running viewport the controls drive.
 * @param state - The workbench's own state, mutated in place.
 * @param onStructuralChange - Called when a control changes something the panel's other rows should re-read.
 * @returns The groups, ready for the panel.
 *
 * @example Mounting the panel
 * ```typescript
 * const panel = createControlPanel(buildControlGroups(viewport, state, () => panel.refresh()))
 * ```
 */
export function buildControlGroups(viewport: Viewport, state: WorkbenchState, onStructuralChange: () => void): ControlGroup[] {
  const koi = viewport.koi
  const physical = koi.config.physical
  const appearance = koi.config.appearance

  /**
   * A slider bound to one number on the koi's build.
   *
   * @param label - What the control is called.
   * @param min - Lowest value it offers.
   * @param max - Highest value it offers.
   * @param step - How finely it moves.
   * @param get - Reads the current value.
   * @param set - Writes a new value.
   * @returns The control.
   */
  const slider = (label: string, min: number, max: number, step: number, get: () => number, set: (value: number) => void) =>
    <const>{ kind: 'slider', label, min, max, step, get, set }

  /**
   * A toggle bound to one debug overlay.
   *
   * @param label - What the overlay is called.
   * @param key - Which flag it drives.
   * @returns The control.
   */
  const overlay = (label: string, key: keyof KoiDebugFlags) =>
    <const>{
      kind: 'toggle',
      label,
      get: () => state.debug[key],
      set: (value: boolean) => {
        state.debug[key] = value
        viewport.setDebug({ [key]: value })
      },
    }

  return [
    {
      title: 'Camera',
      controls: [
        {
          kind: 'select',
          label: 'Mode',
          options: ['production', 'orbit'],
          get: () => state.cameraMode,
          set: (value) => {
            state.cameraMode = value === 'orbit' ? 'orbit' : 'production'
            viewport.setCameraMode(state.cameraMode)
          },
        },
        slider(
          'Angle off vertical',
          0,
          80,
          1,
          () => state.tilt,
          (value) => {
            state.tilt = value
            viewport.setFraming(state.tilt, state.swing, state.distance)
          }
        ),
        slider(
          'Swing around',
          -180,
          180,
          1,
          () => state.swing,
          (value) => {
            state.swing = value
            viewport.setFraming(state.tilt, state.swing, state.distance)
          }
        ),
        slider(
          'Zoom',
          1.1,
          6,
          0.05,
          () => state.distance,
          (value) => {
            state.distance = value
            viewport.setFraming(state.tilt, state.swing, state.distance)
          }
        ),
        {
          kind: 'button',
          label: 'Reset to production view',
          run: () => {
            state.cameraMode = 'production'
            viewport.setCameraMode('production')
            viewport.setFraming(state.tilt, state.swing, state.distance)
            viewport.resetCamera()
          },
        },
        {
          kind: 'select',
          label: 'Backdrop',
          options: BACKDROPS,
          get: () => state.backdrop,
          set: (value) => {
            state.backdrop = <BackdropName>value
            viewport.setBackdrop(state.backdrop)
          },
        },
        {
          kind: 'select',
          label: 'Lighting',
          options: KOI_LIGHTING_PRESETS,
          get: () => state.lighting,
          set: (value) => {
            state.lighting = <KoiLightingPreset>value
            viewport.setLighting(state.lighting)
          },
        },
      ],
    },
    {
      title: 'Body',
      controls: [
        slider(
          'Length',
          0.4,
          2.2,
          0.01,
          () => physical.length,
          (value) => koi.setPhysical({ length: value })
        ),
        slider(
          'Width',
          0.55,
          1.7,
          0.01,
          () => physical.width,
          (value) => koi.setPhysical({ width: value })
        ),
        slider(
          'Height',
          0.55,
          1.7,
          0.01,
          () => physical.height,
          (value) => koi.setPhysical({ height: value })
        ),
        slider(
          'Shoulder width',
          0.6,
          1.7,
          0.01,
          () => physical.shoulder,
          (value) => koi.setPhysical({ shoulder: value })
        ),
        slider(
          'Belly fullness',
          0,
          1.4,
          0.01,
          () => physical.belly,
          (value) => koi.setPhysical({ belly: value })
        ),
        slider(
          'Dorsal ridge',
          0,
          1.2,
          0.01,
          () => physical.dorsalRidge,
          (value) => koi.setPhysical({ dorsalRidge: value })
        ),
        slider(
          'Tail-base width',
          0.4,
          2,
          0.01,
          () => physical.peduncleWidth,
          (value) => koi.setPhysical({ peduncleWidth: value })
        ),
        slider(
          'Tail-base depth',
          0.4,
          2,
          0.01,
          () => physical.peduncleDepth,
          (value) => koi.setPhysical({ peduncleDepth: value })
        ),
      ],
    },
    {
      title: 'Head and eyes',
      controls: [
        slider(
          'Head length',
          0.14,
          0.44,
          0.005,
          () => physical.head.length,
          (value) => koi.setPhysical({ head: { ...physical.head, length: value } })
        ),
        slider(
          'Head width',
          0.6,
          1.8,
          0.01,
          () => physical.head.width,
          (value) => koi.setPhysical({ head: { ...physical.head, width: value } })
        ),
        slider(
          'Head height',
          0.6,
          1.8,
          0.01,
          () => physical.head.height,
          (value) => koi.setPhysical({ head: { ...physical.head, height: value } })
        ),
        slider(
          'Snout bluntness',
          0,
          1.6,
          0.01,
          () => physical.head.snout,
          (value) => koi.setPhysical({ head: { ...physical.head, snout: value } })
        ),
        slider(
          'Forehead dome',
          0,
          1.4,
          0.01,
          () => physical.head.forehead,
          (value) => koi.setPhysical({ head: { ...physical.head, forehead: value } })
        ),
        slider(
          'Eye station',
          0.05,
          0.24,
          0.002,
          () => physical.eyes.station,
          (value) => koi.setPhysical({ eyes: { ...physical.eyes, station: value } })
        ),
        slider(
          'Eye spacing',
          0.4,
          1.6,
          0.01,
          () => physical.eyes.spacing,
          (value) => koi.setPhysical({ eyes: { ...physical.eyes, spacing: value } })
        ),
        slider(
          'Eye size',
          0.006,
          0.042,
          0.0005,
          () => physical.eyes.size,
          (value) => koi.setPhysical({ eyes: { ...physical.eyes, size: value } })
        ),
        slider(
          'Eye protrusion',
          0,
          1,
          0.01,
          () => physical.eyes.protrusion,
          (value) => koi.setPhysical({ eyes: { ...physical.eyes, protrusion: value } })
        ),
        slider(
          'Eye rise',
          -0.3,
          1,
          0.01,
          () => physical.eyes.rise,
          (value) => koi.setPhysical({ eyes: { ...physical.eyes, rise: value } })
        ),
      ],
    },
    {
      title: 'Fins and tail',
      controls: [
        slider(
          'Tail span',
          0.12,
          0.52,
          0.005,
          () => physical.caudal.span,
          (value) => koi.setPhysical({ caudal: { ...physical.caudal, span: value } })
        ),
        slider(
          'Tail fork',
          0,
          0.8,
          0.01,
          () => physical.caudal.fork,
          (value) => koi.setPhysical({ caudal: { ...physical.caudal, fork: value } })
        ),
        slider(
          'Tail sweep',
          0,
          0.6,
          0.01,
          () => physical.caudal.sweep,
          (value) => koi.setPhysical({ caudal: { ...physical.caudal, sweep: value } })
        ),
        slider(
          'Tail spread',
          0,
          0.4,
          0.01,
          () => physical.caudal.spread,
          (value) => koi.setPhysical({ caudal: { ...physical.caudal, spread: value } })
        ),
        slider(
          'Pectoral span',
          0.04,
          0.3,
          0.005,
          () => physical.pectoral.span,
          (value) => koi.setPhysical({ pectoral: { ...physical.pectoral, span: value } })
        ),
        slider(
          'Pectoral sweep',
          0,
          1.2,
          0.01,
          () => physical.pectoral.sweep,
          (value) => koi.setPhysical({ pectoral: { ...physical.pectoral, sweep: value } })
        ),
        slider(
          'Pectoral girth',
          0.14,
          0.46,
          0.005,
          () => physical.pectoral.girth,
          (value) => koi.setPhysical({ pectoral: { ...physical.pectoral, girth: value } })
        ),
        slider(
          'Dorsal span',
          0.02,
          0.2,
          0.002,
          () => physical.dorsal.span,
          (value) => koi.setPhysical({ dorsal: { ...physical.dorsal, span: value } })
        ),
        slider(
          'Dorsal root length',
          0.06,
          0.4,
          0.005,
          () => physical.dorsal.root,
          (value) => koi.setPhysical({ dorsal: { ...physical.dorsal, root: value } })
        ),
        slider(
          'Pelvic span',
          0.02,
          0.22,
          0.002,
          () => physical.pelvic.span,
          (value) => koi.setPhysical({ pelvic: { ...physical.pelvic, span: value } })
        ),
        slider(
          'Anal span',
          0.02,
          0.18,
          0.002,
          () => physical.anal.span,
          (value) => koi.setPhysical({ anal: { ...physical.anal, span: value } })
        ),
      ],
    },
    {
      title: 'Movement',
      controls: [
        {
          kind: 'select',
          label: 'Preset',
          options: Object.keys(MOTION_PRESETS),
          get: () => state.preset,
          set: (value) => {
            state.preset = value
            const preset = MOTION_PRESETS[value]
            if (preset !== undefined) {
              koi.setMotion(preset)
            }
            onStructuralChange()
          },
        },
        slider(
          'Speed',
          0,
          4,
          0.01,
          () => koi.swim.motion.speed,
          (value) => koi.setMotion({ speed: value })
        ),
        slider(
          'Turn rate',
          -3,
          3,
          0.01,
          () => koi.swim.motion.turnRate,
          (value) => koi.setMotion({ turnRate: value })
        ),
        slider(
          'Escape intensity',
          0,
          1,
          0.01,
          () => koi.swim.motion.escapeIntensity,
          (value) => koi.setMotion({ escapeIntensity: value })
        ),
        slider(
          'Acceleration',
          -3,
          3,
          0.01,
          () => koi.swim.motion.acceleration,
          (value) => koi.setMotion({ acceleration: value })
        ),
        slider(
          'Climb rate',
          -1,
          1,
          0.01,
          () => koi.swim.motion.climbRate,
          (value) => koi.setMotion({ climbRate: value })
        ),
        slider(
          'Tail amplitude',
          0.2,
          2.4,
          0.01,
          () => koi.swim.trim.amplitude,
          (value) => koi.setTrim({ amplitude: value })
        ),
        slider(
          'Tail frequency',
          0.2,
          2.4,
          0.01,
          () => koi.swim.trim.frequency,
          (value) => koi.setTrim({ frequency: value })
        ),
        slider(
          'Body-wave reach',
          -0.2,
          0.6,
          0.01,
          () => koi.swim.trim.waveReach,
          (value) => koi.setTrim({ waveReach: value })
        ),
        slider(
          'Body-wave propagation',
          0.3,
          2.2,
          0.01,
          () => koi.swim.trim.wavesPerBody,
          (value) => koi.setTrim({ wavesPerBody: value })
        ),
        slider(
          'Turn amount',
          0,
          2,
          0.01,
          () => koi.swim.trim.turn,
          (value) => koi.setTrim({ turn: value })
        ),
        slider(
          'Turn responsiveness',
          0,
          1,
          0.01,
          () => koi.swim.trim.responsiveness,
          (value) => koi.setTrim({ responsiveness: value })
        ),
      ],
    },
    {
      title: 'Freeze and scrub',
      controls: [
        {
          kind: 'toggle',
          label: 'Animate',
          get: () => viewport.running,
          set: (value) => viewport.setRunning(value),
        },
        slider(
          'Beat phase',
          0,
          1,
          0.002,
          () => state.scrub,
          (value) => {
            state.scrub = value
            viewport.setRunning(false)
            viewport.scrubTo(value * Math.PI * 2)
            onStructuralChange()
          }
        ),
      ],
    },
    {
      title: 'Appearance',
      controls: [
        {
          kind: 'select',
          label: 'Pattern',
          options: KOI_PATTERNS,
          get: () => appearance.pattern,
          set: (value) => koi.setAppearance({ pattern: <(typeof KOI_PATTERNS)[number]>value }),
        },
        slider(
          'Seed',
          1,
          4000,
          1,
          () => koi.config.seed,
          (value) => {
            koi.config.seed = Math.round(value)
            koi.setAppearance({})
          }
        ),
        { kind: 'colour', label: 'Base', get: () => appearance.base, set: (value) => koi.setAppearance({ base: value }) },
        { kind: 'colour', label: 'Primary', get: () => appearance.primary, set: (value) => koi.setAppearance({ primary: value }) },
        { kind: 'colour', label: 'Secondary', get: () => appearance.secondary, set: (value) => koi.setAppearance({ secondary: value }) },
        { kind: 'colour', label: 'Accent', get: () => appearance.accent, set: (value) => koi.setAppearance({ accent: value }) },
        slider(
          'Roughness',
          0.05,
          1,
          0.01,
          () => appearance.roughness,
          (value) => koi.setAppearance({ roughness: value })
        ),
        slider(
          'Surface gloss',
          0,
          1,
          0.01,
          () => appearance.gloss,
          (value) => koi.setAppearance({ gloss: value })
        ),
        slider(
          'Fin opacity',
          0.05,
          1,
          0.01,
          () => appearance.finOpacity,
          (value) => koi.setAppearance({ finOpacity: value })
        ),
        slider(
          'Scale relief',
          0,
          1.4,
          0.01,
          () => appearance.scaleDepth,
          (value) => koi.setAppearance({ scaleDepth: value })
        ),
        slider(
          'Scale density',
          8,
          60,
          1,
          () => appearance.scaleDensity,
          (value) => koi.setAppearance({ scaleDensity: value })
        ),
      ],
    },
    {
      title: 'Depth',
      folded: true,
      controls: [
        slider(
          'Apparent depth',
          0,
          1,
          0.01,
          () => koi.swim.motion.depth,
          (value) => koi.setMotion({ depth: value })
        ),
        slider(
          'Scale at floor',
          0.3,
          1,
          0.01,
          () => state.depth.scale,
          (value) => {
            state.depth.scale = value
            koi.setDepthResponse({ scale: value })
          }
        ),
        slider(
          'Brightness at floor',
          0.2,
          1,
          0.01,
          () => state.depth.dim,
          (value) => {
            state.depth.dim = value
            koi.setDepthResponse({ dim: value })
          }
        ),
        slider(
          'Water tint strength',
          0,
          1,
          0.01,
          () => state.depth.fade,
          (value) => {
            state.depth.fade = value
            koi.setDepthResponse({ fade: value })
          }
        ),
        {
          kind: 'colour',
          label: 'Water tint',
          get: () => state.depth.tint,
          set: (value) => {
            state.depth.tint = value
            koi.setDepthResponse({ tint: value })
          },
        },
      ],
    },
    {
      title: 'Debug overlays',
      folded: true,
      controls: [
        overlay('Wireframe', 'wireframe'),
        overlay('Spine', 'spine'),
        overlay('Spine stations', 'stations'),
        overlay('Cross sections', 'sections'),
        overlay('Mesh normals', 'normals'),
        overlay('Bounding volume', 'bounds'),
        overlay('Collision chain', 'collision'),
        overlay('Forward heading', 'heading'),
        overlay('Awareness cone', 'awareness'),
      ],
    },
    {
      title: 'Tessellation',
      folded: true,
      controls: [
        slider(
          'Rings along body',
          12,
          96,
          1,
          () => koi.config.resolution.rings,
          (value) => koi.setResolution({ rings: Math.round(value) })
        ),
        slider(
          'Vertices around body',
          8,
          48,
          1,
          () => koi.config.resolution.radial,
          (value) => koi.setResolution({ radial: Math.round(value) })
        ),
        slider(
          'Fin spans',
          3,
          18,
          1,
          () => koi.config.resolution.finSpans,
          (value) => koi.setResolution({ finSpans: Math.round(value) })
        ),
        slider(
          'Fin segments',
          3,
          18,
          1,
          () => koi.config.resolution.finSegments,
          (value) => koi.setResolution({ finSegments: Math.round(value) })
        ),
      ],
    },
  ]
}
