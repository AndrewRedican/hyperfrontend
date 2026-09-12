import type { MediaProfile } from '../src/models/profile'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { bannerStage } from '../src/banner/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'
import { publishableLibraries, SCOPE } from './lib/libraries'

/**
 * The strip a banner is composed for: the width of a readme column, at a
 * height that holds a name, a line and a row of pills without crowding them.
 */
const BANNER_PROFILE: MediaProfile = {
  id: 'banner',
  intent: 'the top of a package readme, at the width npm and GitHub render it',
  width: 640,
  height: 180,
  scale: 2,
  fps: 4,
}

/**
 * How long the light behind the tile takes to come back round.
 *
 * Long enough that a reader who glances at the strip sees a still image, and
 * only one who lingers notices the ground breathing.
 */
const LOOP_MS = 12_000

/**
 * One line per package, saying what it is for in the fewest words that are
 * still the package's own.
 *
 * The manifest description is the fallback, and it is a fallback because a
 * description written for a registry search result runs long for a strip that
 * has one line's worth of room beside a name set at thirty pixels.
 */
const TAGLINES: Record<string, string> = {
  [`${SCOPE}builder`]: 'Bundles a TypeScript library into ESM, CJS, IIFE and UMD, and writes the manifest that ships with it.',
  [`${SCOPE}cryptography`]: 'Password and key encryption with one call, the same in the browser and in Node.js.',
  [`${SCOPE}features`]: 'Embed another team’s app in yours over a typed, supervised channel: the micro-frontend SDK, CLI and dev server.',
  [`${SCOPE}logging`]: 'Structured, levelled logging with channels and timers; how much survives is decided at run time.',
  [`${SCOPE}network-protocol`]: 'A session-keyed, replay-proof envelope for cross-window and cross-process messages, on any transport.',
  [`${SCOPE}nexus`]: 'Contract-validated messaging between windows, frames and workers, over a real handshake.',
  [`${SCOPE}project-scope`]: 'Reads a repository it has never seen, scores what it finds, and stages writes until you commit them.',
  [`${SCOPE}questions`]: 'Terminal prompts that return a value, never an exception: text, select, confirm, multiselect.',
  [`${SCOPE}state-machine`]: 'The lifecycle of an async operation as a store, with the states a lone isLoading cannot tell apart.',
  [`${SCOPE}versioning`]: 'From conventional commits to the bump, the version and the changelog entry, with nobody choosing.',
  [`${SCOPE}data-utils`]: 'Walk, compare and repair data structures, circular references included.',
  [`${SCOPE}function-utils`]: 'Wrappers that change what a call does without changing what it looks like.',
  [`${SCOPE}immutable-api-utils`]: 'Built-ins captured before untrusted code runs, and objects nothing can tamper with after.',
  [`${SCOPE}json-utils`]: 'JSON Schema validation that reports every violation at once, with the pointer that found it.',
  [`${SCOPE}list-utils`]: 'FIFO and LIFO lists of objects held by reference, with the filtering and iteration to match.',
  [`${SCOPE}random-generator-utils`]: 'Seeded, reproducible random draws from real distributions, plus UUIDs.',
  [`${SCOPE}string-utils`]: 'Base64 and friends that encode UTF-8 first, identical in the browser and in Node.js.',
  [`${SCOPE}time-utils`]: 'Timers that can be paused and resumed, intervals, and time normalisation.',
  [`${SCOPE}ui-utils`]: 'DOM utilities that hand back their own teardown: styles, gestures, element lifecycle, colour.',
}

/** How a supported runtime is named on a pill. */
const RUNTIME_LABELS: Record<string, string> = {
  node: 'Node.js',
  browser: 'Browser',
  webWorker: 'Web Worker',
}

/**
 * The runtimes a package supports, as pill labels.
 *
 * @param environments - Support level by runtime, as the project declares it.
 * @returns One label per runtime the project declares full or partial support for.
 */
function runtimeFacets(environments: Record<string, string>): readonly string[] {
  return keys(RUNTIME_LABELS)
    .filter((key) => environments[key] === 'full' || environments[key] === 'partial')
    .map((key) => RUNTIME_LABELS[key] ?? key)
}

/**
 * One banner per publishable package, drawn from the workspace's own identity
 * file, manifests and project configurations.
 *
 * A banner is a slow loop rather than a still: the ground behind the tile
 * drifts once round its path and joins itself, at a pace that reads as
 * stillness to a glance. The portable one tops the readme npm renders; the two
 * themed ones are there for any surface that knows its own theme.
 */
export default publishableLibraries().map((library) => {
  const entry = packageIdentity(library.manifest.name)
  return defineScriptedScene({
    slug: `banner-${library.shortName}`,
    asset: 'banner',
    outputs: ['gif'],
    profile: BANNER_PROFILE,
    hue: entry.hue,
    stage: bannerStage,
    gif: { colours: 64, lossy: 60, maxBytes: 500_000 },
    config: {
      prefix: SCOPE,
      name: library.shortName,
      tagline: TAGLINES[library.manifest.name] ?? library.manifest.description ?? '',
      mark: entry.mark,
      facets: runtimeFacets(library.project.metadata?.compatibility?.environments ?? {}),
      loopMs: LOOP_MS,
    },
  })
})
