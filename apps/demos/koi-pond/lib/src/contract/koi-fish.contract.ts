/**
 * The contract every koi speaks, whatever framework renders it.
 *
 * The fish owns its body and its motion; the pond owns the world. That split is
 * the whole protocol: the host announces the water, the light, and who else is
 * nearby, and the fish answers with where its body currently is.
 *
 * High-cadence traffic (`outline`, `neighbors`) is deliberately schema-less so
 * the SDK's payload validator is skipped on the hot path — seven fish reporting
 * ten times a second is the one place validation cost would show. Every
 * low-cadence action carries a schema, so a malformed world or a bad depth grant
 * is still caught at the boundary.
 *
 * The shape is declared locally rather than imported from the SDK: the shared
 * lib stays dependency-free so it can be packed and installed into eight apps
 * without dragging a second copy of `@hyperfrontend/features` behind it. Each
 * consuming app checks the object against the real `FeatureContract` type.
 */

/** One action in a direction of the contract. */
export interface KoiActionDescription {
  /** Wire type string identifying the action. */
  type: string
  /** Human-readable explanation, surfaced in the SDK's debug tooling. */
  description?: string
  /** JSON-schema-like payload shape; omitted where per-frame validation cost is not worth paying. */
  schema?: object
}

/** The koi contract's two directions plus its semver cut. */
export interface KoiContract {
  /** Semver contract version; both sides must agree on major and minor below 1.0.0. */
  version: string
  /** Actions the fish handles from the pond host. */
  accepted: KoiActionDescription[]
  /** Actions the fish sends to the pond host. */
  emitted: KoiActionDescription[]
}

/** The contract cut every pond project is built against. */
export const KOI_CONTRACT_VERSION = '0.1.0'

/** The contract the pond host and all seven koi share. */
export const koiFishContract: KoiContract = {
  version: KOI_CONTRACT_VERSION,
  accepted: [
    {
      type: 'pond',
      description:
        'The world this koi swims in: the host-measured frame, how far pond space runs past each edge, the nominal fish length, the depth-level count, and the reduced-motion posture. Resent on every resize.',
      schema: {
        type: 'object',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
          margin: { type: 'number' },
          fishLength: { type: 'number' },
          depthLevels: { type: 'number' },
          reducedMotion: { type: 'boolean' },
        },
        required: ['width', 'height', 'margin', 'fishLength', 'depthLevels', 'reducedMotion'],
      },
    },
    {
      type: 'identity',
      description:
        'Who this koi is: its framework slug, the stable seed every trait derives from, the URL of the app rendering it, and its opening depth level.',
      schema: {
        type: 'object',
        properties: {
          framework: { type: 'string' },
          seed: { type: 'number' },
          url: { type: 'string' },
          depth: { type: 'number' },
        },
        required: ['framework', 'seed', 'url', 'depth'],
      },
    },
    {
      type: 'neighbors',
      description:
        'The koi close enough to matter, after the host broad-phase filtered the shoal. Position, course, speed, depth, and length per neighbour. High cadence, deliberately schema-less.',
    },
    {
      type: 'disturbance',
      description:
        'Something struck the water: an origin in pond space and a 0-to-1 intensity. Whether this koi flees is its own business.',
      schema: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          intensity: { type: 'number' },
        },
        required: ['x', 'y', 'intensity'],
      },
    },
    {
      type: 'depth',
      description: 'The depth level the host granted. The koi renders its own scale, opacity, and roll for it.',
      schema: {
        type: 'object',
        properties: { level: { type: 'number' } },
        required: ['level'],
      },
    },
    {
      type: 'hover',
      description:
        "Whether the host's pointer is over this koi. The host hit-tests against reported outlines; the koi draws its own identity.",
      schema: {
        type: 'object',
        properties: { hovered: { type: 'boolean' } },
        required: ['hovered'],
      },
    },
    {
      type: 'sleep',
      description: 'Whether to hold still. The host pauses off-screen and hidden ponds so seven compositing layers stop costing anything.',
      schema: {
        type: 'object',
        properties: { paused: { type: 'boolean' } },
        required: ['paused'],
      },
    },
  ],
  emitted: [
    {
      type: 'outline',
      description:
        "The koi's occupied outline as nose-first spine samples with a half-width each, plus heading, speed, depth, and behavioural phase. High cadence, deliberately schema-less.",
    },
    {
      type: 'depth-request',
      description:
        'The koi asking to change depth, usually to pass another. The host validates against its cooldown and hysteresis before granting.',
      schema: {
        type: 'object',
        properties: { level: { type: 'number' } },
        required: ['level'],
      },
    },
    {
      type: 'ripple-request',
      description:
        'A request for a surface ripple at a pond coordinate. Honoured only for the level just under the surface, and rate-limited by the host.',
      schema: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          strength: { type: 'number' },
        },
        required: ['x', 'y', 'strength'],
      },
    },
    {
      type: 'settled',
      description:
        'This koi finished fleeing and resumed ambient cruising. The host waits for all seven before it calls a disturbance sequence complete.',
      schema: {
        type: 'object',
        properties: { framework: { type: 'string' } },
        required: ['framework'],
      },
    },
  ],
}
