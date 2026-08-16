/**
 * Library coordinates the guide compiler needs from the docs generation config.
 */
export interface LibrarySource {
  /** Display name */
  name: string
  /** npm package name */
  packageName: string
  /** Generated-content slug */
  slug: string
  /** Source path relative to workspace root */
  srcPath: string
}

/**
 * How a guide's code examples were proven correct.
 *
 * `demo` extracts them from source that ships and runs for its own reasons, so
 * they cannot silently rot. `authored` means the examples were executed against
 * a published package while the guide was written: correct on that date, at
 * that version, and honest with the reader about both.
 */
export interface GuideVerification {
  /** Verification lane */
  kind: 'demo' | 'authored'
  /** Workspace-relative path to the shipped source carrying the snippet regions (required when kind is 'demo') */
  source?: string
  /** Package and version the examples were run against, e.g. '@hyperfrontend/nexus@2.0.1' (required when kind is 'authored') */
  verifiedAgainst?: string
  /** ISO date the examples were last executed (required when kind is 'authored') */
  verifiedOn?: string
}

/**
 * An `apis` entry pairing a package with one of its exported symbols.
 */
export interface GuideApiRef {
  /** npm package name */
  package: string
  /** Exported symbol name, verified against the TypeDoc output */
  symbol: string
}

/**
 * What a reader needs before starting a guide.
 */
export interface GuidePrerequisites {
  /** Slugs of guides to complete first */
  guides?: string[]
  /** Free-form knowledge assumptions */
  knowledge?: string[]
}

/**
 * Onward links from a guide.
 */
export interface GuideRelated {
  /** Slugs of related guides */
  guides?: string[]
  /** Site routes to reference material */
  reference?: string[]
  /** Site routes to explanation material */
  explanation?: string[]
}

/**
 * Guide metadata schema (guide-meta v1), authored as `meta.json` beside `guide.md`.
 */
export interface GuideMeta {
  /** Schema version; currently always 1 */
  schemaVersion: number
  /** Diátaxis-aligned document type */
  type: 'tutorial' | 'how-to' | 'troubleshooting' | 'recipe'
  /** Guide title, matching the guide.md H1 */
  title: string
  /** The reader problem this guide solves; primary index and discovery text */
  problem: string
  /** What the reader has working at the end */
  outcome: string
  /** Editorial priority */
  priority: 'P0' | 'P1' | 'P2'
  /** Involved npm packages; the first entry is the owning package */
  packages: string[]
  /** How the guide's code examples are proven to execute */
  verification: GuideVerification
  /** Additional workspace-relative files holding snippet regions (beyond verification.source) */
  snippetSources?: string[]
  /** Slug of the shipped demo this guide is built on, for demo-backed guides */
  demo?: string
  /** Reader skill level */
  complexity?: 'beginner' | 'intermediate' | 'advanced'
  /** Estimated completion time in minutes */
  estMinutes?: number
  /** Symbols this guide teaches, verified against generated API data */
  apis?: GuideApiRef[]
  /** What a reader needs before starting */
  prerequisites?: GuidePrerequisites
  /** Onward links */
  related?: GuideRelated
  /** Additional discovery keywords */
  keywords?: string[]
}

/**
 * A discovered guide unit: one `libs/<lib>/docs/guides/<slug>/` directory.
 */
export interface GuideUnit {
  /** Global guide slug (the directory name) */
  slug: string
  /** Absolute path to the unit directory */
  dir: string
  /** Absolute path to meta.json */
  metaPath: string
  /** Absolute path to guide.md */
  guidePath: string
  /** The library owning this unit */
  library: LibrarySource
}

/**
 * A snippet region extracted from between `ref: [guide:<slug>/<region>]` markers.
 */
export interface SnippetRegion {
  /** Dedented code between the markers */
  code: string
  /** Workspace-relative source path */
  sourcePath: string
  /** First content line (1-based, after the start marker) */
  startLine: number
  /** Last content line (1-based, before the end marker) */
  endLine: number
}

/**
 * One guide's entry in the compiled corpus index.
 */
export interface GuideIndexEntry {
  /** Global guide slug */
  slug: string
  /** Site route */
  route: string
  /** Diátaxis-aligned document type */
  type: GuideMeta['type']
  /** Guide title */
  title: string
  /** The reader problem this guide solves */
  problem: string
  /** What the reader has working at the end */
  outcome: string
  /** Editorial priority */
  priority: GuideMeta['priority']
  /** Involved npm packages; the first entry is the owning package */
  packages: string[]
  /** How the guide's code examples are proven to execute */
  verification: GuideVerification
  /** Slug of the shipped demo this guide is built on, if any */
  demo?: string
  /** Reader skill level */
  complexity?: GuideMeta['complexity']
  /** Estimated completion time in minutes */
  estMinutes?: number
  /** What a reader needs before starting */
  prerequisites?: GuidePrerequisites
  /** Onward links */
  related?: GuideRelated
  /** Additional discovery keywords */
  keywords: string[]
}

/**
 * The compiled guide corpus index, emitted to `.generated/guides/index.json`
 * and published at `/guides/index.json`.
 */
export interface GuideIndex {
  /** Index schema version; currently always 1 */
  schemaVersion: number
  /** ISO timestamp of the compiling run */
  generatedAt: string
  /** Every compiled guide, slug-sorted */
  guides: GuideIndexEntry[]
}
