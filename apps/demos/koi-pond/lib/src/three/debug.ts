/**
 * The overlays that make a koi's geometry inspectable.
 *
 * None of this exists unless something asks for it. The layer is inert until a
 * toggle is turned on, every buffer is allocated on first use, and the whole
 * group can be left out of a build by simply never importing this module — the
 * koi itself has no reference to it.
 *
 * Every overlay reads the same posed spine the vertex program does, so what is
 * drawn here is what the koi is actually doing, not a second model of it.
 */
import type { Koi } from './koi.js'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
} from 'three'
import { sampleSection, sectionPoint } from '../koi3d/anatomy.js'
import { CAUDAL_ROOT } from '../koi3d/config.js'
import { SPINE_SAMPLES } from '../koi3d/spine-pose.js'

/** Which overlays are showing. All default to off. */
export interface KoiDebugFlags {
  /** Draw every surface as wireframe. */
  wireframe: boolean
  /** Draw the posed centreline. */
  spine: boolean
  /** Draw a dot at every spine station. */
  stations: boolean
  /** Draw the body's cross-sections around the posed spine. */
  sections: boolean
  /** Draw a whisker along each vertex normal. */
  normals: boolean
  /** Draw the box the koi's rest mesh occupies. */
  bounds: boolean
  /** Draw the sphere chain a neighbour would collide with. */
  collision: boolean
  /** Draw the koi's forward heading. */
  heading: boolean
  /** Draw the cone the koi notices things in. */
  awareness: boolean
}

/** Nothing showing, which is how every koi starts. */
export const NO_DEBUG: KoiDebugFlags = {
  wireframe: false,
  spine: false,
  stations: false,
  sections: false,
  normals: false,
  bounds: false,
  collision: false,
  heading: false,
  awareness: false,
}

/** The debug layer attached to one koi. */
export interface KoiDebugLayer {
  /** The group to add to the scene beside the koi. */
  readonly object: Group
  /**
   * Turns overlays on and off.
   *
   * @param flags - Which overlays should show; anything left out keeps its current state.
   */
  setFlags(flags: Partial<KoiDebugFlags>): void
  /** Redraws every showing overlay from the koi's current pose. */
  update(): void
  /** Releases every GPU resource the layer holds. */
  dispose(): void
}

/** How many rings the cross-section overlay draws along the body. */
const SECTION_RINGS = 11

/** How many points describe one cross-section ring. */
const SECTION_STEPS = 28

/** How wide the awareness cone opens, in radians either side of the heading. */
const AWARENESS_HALF_ANGLE = 1.05

/**
 * Builds a line overlay with a fixed vertex budget.
 *
 * @param capacity - How many vertices the overlay may draw.
 * @param colour - The line colour.
 * @param segments - Whether the vertices are independent segments rather than one strip.
 * @returns The overlay object, its material, and the buffer to write into.
 */
function createLines(
  capacity: number,
  colour: string,
  segments: boolean
): { object: Line | LineSegments; material: LineBasicMaterial; positions: Float32Array; attribute: BufferAttribute } {
  const positions = new Float32Array(capacity * 3)
  const attribute = new BufferAttribute(positions, 3)
  attribute.setUsage(35048)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', attribute)
  const material = new LineBasicMaterial({
    color: new Color(colour),
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    blending: AdditiveBlending,
  })
  const object = segments ? new LineSegments(geometry, material) : new Line(geometry, material)
  object.frustumCulled = false
  object.renderOrder = 10
  return { object, material, positions, attribute }
}

/**
 * Attaches a debug layer to a koi.
 *
 * @param koi - The koi to inspect.
 * @returns The layer, with every overlay off.
 *
 * @example Showing the spine while tuning a turn
 * ```typescript
 * const debug = createKoiDebugLayer(koi)
 * scene.add(debug.object)
 * debug.setFlags({ spine: true, stations: true })
 * ```
 */
export function createKoiDebugLayer(koi: Koi): KoiDebugLayer {
  const flags: KoiDebugFlags = { ...NO_DEBUG }
  const object = new Group()
  object.name = 'koi-debug'

  const spine = createLines(SPINE_SAMPLES, '#7fe8ff', false)
  const sections = createLines(SECTION_RINGS * SECTION_STEPS * 2, '#ffb46b', true)
  const collision = createLines(64 * 2, '#ff6bd6', true)
  const heading = createLines(2, '#8bff7f', true)
  const awareness = createLines(6, '#f2ff7f', true)
  const bounds = createLines(24, '#9aa4b2', true)
  const normals = createLines(2048, '#6b8dff', true)

  const stationPositions = new Float32Array(SPINE_SAMPLES * 3)
  const stationAttribute = new BufferAttribute(stationPositions, 3)
  stationAttribute.setUsage(35048)
  const stationGeometry = new BufferGeometry()
  stationGeometry.setAttribute('position', stationAttribute)
  const stations = new Points(
    stationGeometry,
    new PointsMaterial({ color: new Color('#ffffff'), size: 5, sizeAttenuation: false, depthTest: false })
  )
  stations.frustumCulled = false
  stations.renderOrder = 11

  const overlays = { spine, sections, collision, heading, awareness, bounds, normals }
  object.add(spine.object, sections.object, collision.object, heading.object, awareness.object, bounds.object, normals.object, stations)
  for (const overlay of Object.values(overlays)) {
    overlay.object.visible = false
  }
  stations.visible = false

  const write = (target: Float32Array, index: number, point: readonly [number, number, number]): void => {
    target[index * 3] = point[0]
    target[index * 3 + 1] = point[1]
    target[index * 3 + 2] = point[2]
  }

  /**
   * Rotates a cross-section offset into a station's own frame.
   *
   * @param station - The posed station.
   * @param y - Dorsal offset in scene units.
   * @param z - Lateral offset in scene units.
   * @returns The offset point in the koi's local space.
   */
  const place = (
    station: { position: [number, number, number]; yaw: number; roll: number },
    y: number,
    z: number
  ): [number, number, number] => {
    const rolledY = y * Math.cos(station.roll) - z * Math.sin(station.roll)
    const rolledZ = y * Math.sin(station.roll) + z * Math.cos(station.roll)
    return [
      station.position[0] - rolledZ * Math.sin(station.yaw),
      station.position[1] + rolledY,
      station.position[2] + rolledZ * Math.cos(station.yaw),
    ]
  }

  return {
    object,

    setFlags(next) {
      Object.assign(flags, next)
      spine.object.visible = flags.spine
      stations.visible = flags.stations
      sections.object.visible = flags.sections
      collision.object.visible = flags.collision
      heading.object.visible = flags.heading
      awareness.object.visible = flags.awareness
      bounds.object.visible = flags.bounds
      normals.object.visible = flags.normals
      for (const surface of [koi.surfaces.skin, koi.surfaces.fins, koi.surfaces.eyes]) {
        surface.material.wireframe = flags.wireframe
      }
      object.position.copy(koi.object.position)
      object.quaternion.copy(koi.object.quaternion)
      object.scale.copy(koi.object.scale)
    },

    update() {
      object.position.copy(koi.object.position)
      object.quaternion.copy(koi.object.quaternion)
      object.scale.copy(koi.object.scale)

      const pose = koi.pose
      const length = koi.config.physical.length

      if (flags.spine || flags.stations) {
        pose.stations.forEach((station, index) => {
          write(spine.positions, index, station.position)
          write(stationPositions, index, station.position)
        })
        spine.attribute.needsUpdate = true
        stationAttribute.needsUpdate = true
      }

      if (flags.sections) {
        let cursor = 0
        for (let ring = 0; ring < SECTION_RINGS; ring += 1) {
          const along = (ring / (SECTION_RINGS - 1)) * CAUDAL_ROOT
          const station = pose.stations[Math.round(along * (SPINE_SAMPLES - 1))]
          if (station === undefined) {
            continue
          }
          const section = sampleSection(koi.config.physical, along / CAUDAL_ROOT)
          for (let step = 0; step < SECTION_STEPS; step += 1) {
            const here = sectionPoint(section, step / SECTION_STEPS)
            const next = sectionPoint(section, (step + 1) / SECTION_STEPS)
            write(sections.positions, cursor, place(station, here.y * CAUDAL_ROOT * length, here.z * CAUDAL_ROOT * length))
            write(sections.positions, cursor + 1, place(station, next.y * CAUDAL_ROOT * length, next.z * CAUDAL_ROOT * length))
            cursor += 2
          }
        }
        sections.positions.fill(0, cursor * 3)
        sections.attribute.needsUpdate = true
      }

      if (flags.collision) {
        const chain = koi.collisionChain(9)
        let cursor = 0
        chain.points.forEach((point, index) => {
          const radius = chain.radii[index] ?? 0
          for (let step = 0; step < 12; step += 1) {
            const from = (step / 12) * Math.PI * 2
            const to = ((step + 1) / 12) * Math.PI * 2
            write(collision.positions, cursor, [point[0] + Math.cos(from) * radius, point[1], point[2] + Math.sin(from) * radius])
            write(collision.positions, cursor + 1, [point[0] + Math.cos(to) * radius, point[1], point[2] + Math.sin(to) * radius])
            cursor += 2
          }
        })
        collision.positions.fill(0, cursor * 3)
        collision.attribute.needsUpdate = true
      }

      if (flags.heading || flags.awareness) {
        const nose = pose.stations[0]?.position ?? [0, 0, 0]
        write(heading.positions, 0, nose)
        write(heading.positions, 1, [nose[0] + length * 0.9, nose[1], nose[2]])
        heading.attribute.needsUpdate = true
        const reach = length * 2.4
        for (const [index, sign] of [-1, 1].entries()) {
          write(awareness.positions, index * 2, nose)
          write(awareness.positions, index * 2 + 1, [
            nose[0] + Math.cos(AWARENESS_HALF_ANGLE) * reach,
            nose[1],
            nose[2] + Math.sin(AWARENESS_HALF_ANGLE) * reach * sign,
          ])
        }
        awareness.attribute.needsUpdate = true
      }

      if (flags.bounds) {
        const radius = koi.surfaces.skin.geometry.boundingSphere?.radius ?? length * 0.6
        const corners: [number, number, number][] = [
          [radius, radius, radius],
          [-radius, radius, radius],
          [-radius, -radius, radius],
          [radius, -radius, radius],
        ]
        for (let step = 0; step < 4; step += 1) {
          write(bounds.positions, step * 2, corners[step] ?? [0, 0, 0])
          write(bounds.positions, step * 2 + 1, corners[(step + 1) % 4] ?? [0, 0, 0])
        }
        bounds.attribute.needsUpdate = true
      }

      if (flags.normals) {
        const positions = koi.surfaces.skin.geometry.getAttribute('position')
        const directions = koi.surfaces.skin.geometry.getAttribute('normal')
        if (positions !== undefined && directions !== undefined) {
          const stride = Math.max(1, Math.floor(positions.count / 1024))
          let cursor = 0
          for (let index = 0; index < positions.count && cursor < 2046; index += stride) {
            const point: [number, number, number] = [positions.getX(index), positions.getY(index), positions.getZ(index)]
            write(normals.positions, cursor, point)
            write(normals.positions, cursor + 1, [
              point[0] + directions.getX(index) * length * 0.03,
              point[1] + directions.getY(index) * length * 0.03,
              point[2] + directions.getZ(index) * length * 0.03,
            ])
            cursor += 2
          }
          normals.positions.fill(0, cursor * 3)
          normals.attribute.needsUpdate = true
        }
      }
    },

    dispose() {
      object.removeFromParent()
      for (const overlay of Object.values(overlays)) {
        overlay.object.geometry.dispose()
        overlay.material.dispose()
      }
      stationGeometry.dispose()
      stations.material.dispose()
    },
  }
}
