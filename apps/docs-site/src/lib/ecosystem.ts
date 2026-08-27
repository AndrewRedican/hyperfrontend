import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Identifier for one level of the ecosystem hierarchy.
 */
export type EcosystemTierId = 'sdk' | 'messaging' | 'tooling' | 'primitives' | 'standalone' | 'utilities'

/**
 * How much visual weight a level's cards carry. Weight falls as the reader
 * descends, which is the whole point of the composition: the SDK is the thing
 * you install, and everything below it is the machinery that thing rests on.
 */
export type EcosystemEmphasis = 'apex' | 'strong' | 'medium' | 'soft'

/**
 * One level of the ecosystem hierarchy, and how it is drawn.
 */
export interface EcosystemTier {
  /** Stable identifier for the level */
  id: EcosystemTierId
  /** Short label naming the level. The apex shows it as an eyebrow, every other level as a bead on the spine. */
  label: string
  /** Visual weight the level's cards carry */
  emphasis: EcosystemEmphasis
  /** How many cards sit side by side once there is room for them */
  columns: 1 | 2 | 3
  /** How many keywords a card at this level shows */
  topicLimit: number
  /** Packages on this level, in the order they are shown */
  packages: readonly string[]
}

/**
 * The HyperFrontend ecosystem, top to bottom.
 *
 * This is an editorial model of the packages, informed by the architecture but
 * not derived from it: it is not the dependency graph, and a level below
 * another is not imported by it. Levels answer one question, "how close is
 * this to the problem a visitor arrived with", so the reader can start at the
 * top and stop reading whenever they have found their altitude.
 *
 * Placement weighs six things, in this order. How broad the problem the
 * package solves is for someone building a micro-frontend. How high the
 * abstraction sits, from a platform capability down to a generic helper. What
 * role it plays inside `@hyperfrontend/features`. Whether it establishes a
 * platform concern of its own such as communication, boundaries, lifecycle,
 * security, building, or release. Whether it stands up on its own for an
 * audience that never touches a micro-frontend. And how foundational and
 * generic it is, which pushes a package down even when it is load-bearing.
 *
 * Deliberately not weighed: import counts, dependency depth, lines of code,
 * age, or alphabetical order. `@hyperfrontend/immutable-api-utils` is the most
 * imported package in the flagship and still sits near the base, because what
 * it offers a consumer is narrow. `@hyperfrontend/builder` is invisible at
 * runtime and still leads its level, because it is the engine behind the
 * flagship's promise that a host installs one package and inherits nothing
 * else.
 *
 * The one considered inversion of the abstraction ladder: build-time tooling
 * sits above the runtime primitives, because breadth, flagship role, and
 * architectural significance all point that way, and because the flagship
 * describes its own scope as an SDK, a CLI, and a dev server rather than an
 * SDK alone.
 */
export const ECOSYSTEM_TIERS: readonly EcosystemTier[] = [
  {
    id: 'sdk',
    label: 'Start here',
    emphasis: 'apex',
    columns: 1,
    topicLimit: 6,
    packages: ['@hyperfrontend/features'],
  },
  {
    id: 'messaging',
    label: 'Cross-window messaging and transport',
    emphasis: 'strong',
    columns: 2,
    topicLimit: 4,
    // why: nexus leads because it is the session protocol every path through the SDK runs on, and it stands alone without an iframe, CLI, or build opinion attached; network-protocol follows as the encrypted envelope behind the seam nexus defines but leaves open.
    packages: ['@hyperfrontend/nexus', '@hyperfrontend/network-protocol'],
  },
  {
    id: 'tooling',
    label: 'Build, release, and CLI tooling',
    emphasis: 'medium',
    columns: 2,
    topicLimit: 3,
    // why: what the `hf` command is made of, ordered by how large the problem is on its own: builder packages a feature, versioning owns commits through releases, project-scope is the file layer both of those stand on, questions is the prompt surface of a single command.
    packages: ['@hyperfrontend/builder', '@hyperfrontend/versioning', '@hyperfrontend/project-scope', '@hyperfrontend/questions'],
  },
  {
    id: 'primitives',
    label: 'Primitives the runtime is built from',
    emphasis: 'medium',
    columns: 3,
    topicLimit: 3,
    // why: the three browser-shipping packages the host and hostee runtimes are assembled out of, all understated by their names: json-utils validates the feature contract, ui-utils is the DOM under the presentation model, immutable-api-utils is the hardened-globals source both sides read from.
    packages: ['@hyperfrontend/json-utils', '@hyperfrontend/ui-utils', '@hyperfrontend/immutable-api-utils'],
  },
  {
    id: 'standalone',
    label: 'Standalone runtime libraries',
    emphasis: 'soft',
    columns: 3,
    topicLimit: 2,
    // why: libraries the SDK does not use and does not need, each solving a problem an application has whether or not it is a micro-frontend, ordered by how many readers arrive already having that problem.
    packages: ['@hyperfrontend/state-machine', '@hyperfrontend/logging', '@hyperfrontend/cryptography'],
  },
  {
    id: 'utilities',
    label: 'Single-purpose utilities',
    emphasis: 'soft',
    columns: 3,
    topicLimit: 2,
    // why: the base of the composition, and the widest level for that reason: packages that solve one thing and say so, ordered by the size of that one thing.
    packages: [
      '@hyperfrontend/data-utils',
      '@hyperfrontend/time-utils',
      '@hyperfrontend/random-generator-utils',
      '@hyperfrontend/string-utils',
      '@hyperfrontend/list-utils',
      '@hyperfrontend/function-utils',
      '@hyperfrontend/web-worker',
    ],
  },
]

/**
 * The facts about one package that the ecosystem view draws.
 */
export interface EcosystemLibrary {
  /** Library display name */
  name: string
  /** npm package name */
  packageName: string
  /** Description, as the package's own package.json states it */
  description: string
  /** Keywords, as the package's own package.json lists them */
  keywords: string[]
  /** Released version, empty when the package carries none */
  version: string
  /** Whether the package is withheld from the registry */
  isPrivate: boolean
  /** Route to the package's documentation */
  href: string
}

/**
 * One package, ready to draw.
 */
export interface EcosystemCard extends EcosystemLibrary {
  /** The few keywords worth showing at this level */
  topics: string[]
}

/**
 * One level of the hierarchy with the packages placed on it.
 */
export interface EcosystemLevel {
  /** How the level is drawn */
  tier: EcosystemTier
  /** The packages on it, in presentation order */
  cards: EcosystemCard[]
}

/**
 * Keywords that exist so a package can be found rather than to say what it
 * does: how it is published, what it is written in, and the packages a
 * searcher might be comparing it against. They earn their place on npm and
 * nowhere on a card.
 */
const DISCOVERY_KEYWORDS = createSet([
  'typescript',
  'javascript',
  'zero-dependencies',
  'npm',
  'npm-registry',
  'hyperfrontend',
  'browser',
  'nodejs',
  'node',
  'tree-shaking',
  'tree-shakeable',
  'zod',
  'ajv',
  'winston',
  'bunyan',
])

/**
 * Reduce a keyword to the form two spellings of the same idea share, so
 * `micro-frontend`, `microfrontend`, and `micro-frontends` collapse onto one
 * another.
 *
 * @param keyword - A raw package.json keyword
 * @returns The comparable form
 */
function normalizeKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/s$/, '')
}

/**
 * Pick the handful of keywords a card should show.
 *
 * A package's own npm keywords are the canonical answer to "what is this
 * about", but they are written for a search engine: long, repetitive, and
 * padded with the language it is written in. This keeps the ones that describe
 * the package, in the order its author put them, and drops three kinds that
 * tell a reader nothing new: the package's own name, discovery terms, and a
 * keyword that only extends one already shown.
 *
 * @param keywords - The package's keywords, in package.json order
 * @param packageName - The package's npm name, so it does not label itself
 * @param limit - How many to keep
 * @returns The kept keywords, in their original order
 *
 * @example Keeping what a reader learns something from
 * ```typescript
 * selectTopics(['builder', 'build', 'build-tool', 'bundler', 'typescript'], '@hyperfrontend/builder', 3)
 * // ['build', 'bundler']
 * ```
 */
export function selectTopics(keywords: string[], packageName: string, limit: number): string[] {
  const ownName = normalizeKeyword(packageName.replace(/^@[^/]+\//, ''))
  const kept: string[] = []
  const keptNormalized: string[] = []

  for (const keyword of keywords) {
    if (kept.length >= limit) break
    if (DISCOVERY_KEYWORDS.has(keyword.toLowerCase())) continue

    const normalized = normalizeKeyword(keyword)
    if (normalized === '' || normalized === ownName) continue
    if (keptNormalized.some((seen) => normalized.startsWith(seen) || seen.startsWith(normalized))) continue

    kept.push(keyword)
    keptNormalized.push(normalized)
  }

  return kept
}

/**
 * Place every library on its level of the hierarchy.
 *
 * Placement comes from {@link ECOSYSTEM_TIERS}, so the page's shape is one
 * readable object rather than a rule spread across twenty entries. A library
 * that no level names still appears, on the last one, because a package
 * missing from the index is a worse failure than a package shown at the wrong
 * altitude. A level nothing lands on is dropped, which is what makes the
 * search filter collapse cleanly.
 *
 * @param libraries - Every documented library
 * @returns The levels that have something on them, top to bottom
 */
export function buildEcosystem(libraries: EcosystemLibrary[]): EcosystemLevel[] {
  const byName = createMap(libraries.map((library) => [library.packageName, library]))
  const placed = createSet<string>()
  const levels: EcosystemLevel[] = []

  for (const tier of ECOSYSTEM_TIERS) {
    const cards: EcosystemCard[] = []

    for (const packageName of tier.packages) {
      const library = byName.get(packageName)
      if (!library) continue
      placed.add(packageName)
      cards.push({ ...library, topics: selectTopics(library.keywords, library.packageName, tier.topicLimit) })
    }

    levels.push({ tier, cards })
  }

  const last = levels[levels.length - 1]
  for (const library of libraries) {
    if (placed.has(library.packageName)) continue
    last.cards.push({ ...library, topics: selectTopics(library.keywords, library.packageName, last.tier.topicLimit) })
  }

  return levels.filter((level) => level.cards.length > 0)
}
