/** One drawn element of a mark. */
export interface PackageMarkShape {
  /** SVG element to draw */
  as: 'path' | 'circle' | 'rect'
  /** Geometry attributes for that element */
  attrs: Record<string, string | number>
  /** Whether this is the mark's one solid accent rather than a stroked outline */
  solid?: true
}

/** A complete package mark, drawn back to front. */
export type PackageMark = readonly PackageMarkShape[]

/**
 * A stroked outline.
 *
 * @param d - SVG path data
 * @returns The shape
 */
function line(d: string): PackageMarkShape {
  return { as: 'path', attrs: { d } }
}

/**
 * A stroked circle.
 *
 * @param cx - Centre x
 * @param cy - Centre y
 * @param r - Radius
 * @returns The shape
 */
function ring(cx: number, cy: number, r: number): PackageMarkShape {
  return { as: 'circle', attrs: { cx, cy, r } }
}

/**
 * The mark's solid accent, as a filled circle.
 *
 * @param cx - Centre x
 * @param cy - Centre y
 * @param r - Radius
 * @returns The shape
 */
function dot(cx: number, cy: number, r: number): PackageMarkShape {
  return { as: 'circle', attrs: { cx, cy, r }, solid: true }
}

/**
 * A stroked rounded rectangle.
 *
 * @param x - Left edge
 * @param y - Top edge
 * @param width - How far it runs across the grid
 * @param height - How far it runs down the grid
 * @param rx - Corner radius
 * @returns The shape
 */
function box(x: number, y: number, width: number, height: number, rx: number): PackageMarkShape {
  return { as: 'rect', attrs: { x, y, width, height, rx } }
}

/**
 * The mark's solid accent, as a filled rounded rectangle.
 *
 * @param x - Left edge
 * @param y - Top edge
 * @param width - How far it runs across the grid
 * @param height - How far it runs down the grid
 * @param rx - Corner radius
 * @returns The shape
 */
function slab(x: number, y: number, width: number, height: number, rx: number): PackageMarkShape {
  return { as: 'rect', attrs: { x, y, width, height, rx }, solid: true }
}

/**
 * A package mark's geometry, keyed by the npm package name it belongs to.
 *
 * The key is the package's registry name because that is the identifier every
 * other package-level surface already carries: the ecosystem model, the docs
 * manifest, and the guide corpus all address a package this way, so a mark is
 * looked up with the value a page already has rather than with a slug it would
 * have to map first.
 *
 * Adding a package mark is one entry here. Nothing else changes: the icon
 * component, the library index, and the fallback all read this map.
 */
export const PACKAGE_MARKS: Record<string, PackageMark> = {
  /* The SDK: a host surface with another team's app seated inside it, and the
     contract channel running between them. */
  '@hyperfrontend/features': [
    box(4, 5.5, 24, 21, 3),
    line('M4 11.5h24'),
    dot(7.6, 8.5, 1.15),
    box(16.5, 15, 8.5, 8.5, 2),
    line('M8.5 19.25h4.5'),
  ],

  /* The broker: one hub every participant speaks through, never to each other. */
  '@hyperfrontend/nexus': [
    ring(16, 16, 3.6),
    ring(16, 5.6, 2.1),
    ring(26.4, 16, 2.1),
    ring(16, 26.4, 2.1),
    ring(5.6, 16, 2.1),
    line('M16 12.4V7.7'),
    line('M19.6 16h4.7'),
    line('M16 19.6v4.7'),
    line('M7.7 16h4.7'),
  ],

  /* The sealed envelope: a packet that leaves closed and can only be opened by
     the session that agreed the key. */
  '@hyperfrontend/network-protocol': [
    box(4, 7, 21, 15, 2.5),
    line('M4.9 8.2 14.5 14.6 24.1 8.2'),
    line('M21.4 21v-1.6a2.6 2.6 0 0 1 5.2 0V21'),
    slab(19.5, 21, 9, 7, 2),
  ],

  /* Key material: the bow, the shaft, and the cuts that make one key open one
     thing. */
  '@hyperfrontend/cryptography': [
    ring(11.5, 11.5, 5.5),
    dot(11.5, 11.5, 1.5),
    line('M15.4 15.4 26.5 26.5'),
    line('M22.6 22.6 19.8 25.4'),
    line('M19.3 19.3 16.5 22.1'),
  ],

  /* The bundler: many inputs drawn into one self-contained artifact. */
  '@hyperfrontend/builder': [
    line('M4 8.5h4.5'),
    line('M4 16h4.5'),
    line('M4 23.5h4.5'),
    line('M11 9.5 14.5 16'),
    line('M11 16h3.5'),
    line('M11 22.5 14.5 16'),
    box(17.5, 9.5, 10.5, 13, 2.5),
  ],

  /* The release tag: the label a cut of the history is published under, with
     the three numbers it carries. */
  '@hyperfrontend/versioning': [
    { as: 'rect', attrs: { x: 7.5, y: 7.5, width: 17, height: 17, rx: 3, transform: 'rotate(45 16 16)' } },
    dot(11.4, 16, 1.6),
    ring(16, 16, 1.6),
    ring(20.6, 16, 1.6),
  ],

  /* The scope: brackets around the part of a file tree a tool is allowed to see. */
  '@hyperfrontend/project-scope': [
    line('M10 4.5H7a2.5 2.5 0 0 0-2.5 2.5v3'),
    line('M22 4.5h3A2.5 2.5 0 0 1 27.5 7v3'),
    line('M10 27.5H7A2.5 2.5 0 0 1 4.5 25v-3'),
    line('M22 27.5h3a2.5 2.5 0 0 0 2.5-2.5v-3'),
    dot(11.5, 10.5, 1.6),
    line('M11.5 12.4v8.4'),
    line('M11.5 15.5h6.5'),
    line('M11.5 20.8h6.5'),
  ],

  /* The prompt: the chevron a terminal asks with, and the cursor waiting on
     the answer. */
  '@hyperfrontend/questions': [line('M5.5 8.5 12.5 16l-7 7.5'), slab(16, 11.5, 4.5, 9, 1.4), line('M16 25.5h10.5')],

  /* Schema validation: a value held between braces and checked against a shape. */
  '@hyperfrontend/json-utils': [
    line('M13 5h-2.5a2 2 0 0 0-2 2v5L5.5 16l3 4v5a2 2 0 0 0 2 2H13'),
    line('M19 5h2.5a2 2 0 0 1 2 2v5l3 4-3 4v5a2 2 0 0 1-2 2H19'),
    dot(16, 16, 2.3),
  ],

  /* The DOM layer: an element measured and held by its corners. */
  '@hyperfrontend/ui-utils': [
    box(6.5, 9, 19, 14, 2),
    slab(4, 6.5, 5, 5, 1.5),
    slab(23, 6.5, 5, 5, 1.5),
    slab(4, 20.5, 5, 5, 1.5),
    slab(23, 20.5, 5, 5, 1.5),
  ],

  /* Hardened globals: a sealed shell around a core nothing can reach past. */
  '@hyperfrontend/immutable-api-utils': [
    line('M16 4.2l10.2 5.9v11.8L16 27.8 5.8 21.9V10.1z'),
    { as: 'path', attrs: { d: 'M16 11.4l4.4 2.5v5.2L16 21.6l-4.4-2.5v-5.2z' }, solid: true },
  ],

  /* States and the transition between them, with the one the machine is in
     filled. */
  '@hyperfrontend/state-machine': [ring(9.5, 21, 4.8), ring(22.5, 11, 4.8), dot(22.5, 11, 1.7), line('M13.3 18.1 18.7 13.9')],

  /* The stream: records leaving in order, each one carrying a level. */
  '@hyperfrontend/logging': [
    dot(6.5, 10, 1.7),
    dot(6.5, 16, 1.7),
    dot(6.5, 22, 1.7),
    line('M11 10h16'),
    line('M11 16h10.5'),
    line('M11 22h14'),
  ],

  /* A structure walked to its leaves, and the edge that points back into it. */
  '@hyperfrontend/data-utils': [
    ring(16, 7.2, 2.8),
    ring(8.5, 17.5, 2.8),
    ring(23.5, 17.5, 2.8),
    line('M14.3 9.5 10.2 15.2'),
    line('M17.7 9.5 21.8 15.2'),
    line('M23.5 20.3v1.7a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-1.7'),
  ],

  /* Elapsed time, which is the thing every timer in the package is about. */
  '@hyperfrontend/time-utils': [ring(16, 16, 11.5), line('M16 9V16l4.8 3.2'), dot(16, 16, 1.5)],

  /* The die: a draw from a distribution, reproducible when it is seeded. */
  '@hyperfrontend/random-generator-utils': [box(4.5, 4.5, 23, 23, 4.5), dot(10.8, 10.8, 1.8), dot(16, 16, 1.8), dot(21.2, 21.2, 1.8)],

  /* Transcoding: one value crossing between two representations and back,
     which is what every encoder in the package does. */
  '@hyperfrontend/string-utils': [
    slab(4, 8.5, 6, 6, 1.6),
    line('M13 11.5h13'),
    line('M23 8.5 26 11.5l-3 3'),
    ring(27, 20.5, 3),
    line('M21 20.5H6'),
    line('M9 17.5 6 20.5l3 3'),
  ],

  /* The queue: items waiting in order, the head about to leave. */
  '@hyperfrontend/list-utils': [
    box(4, 11.5, 7, 9, 2),
    box(12.5, 11.5, 7, 9, 2),
    slab(21, 11.5, 7, 9, 2),
    line('M14.5 25.5h11'),
    line('M23 23 25.5 25.5 23 28'),
  ],

  /* A call with a guard on it: what goes in, what the wrapper decides, what
     comes out. */
  '@hyperfrontend/function-utils': [line('M4 16h5.5'), ring(16, 16, 6.5), dot(16, 16, 1.6), line('M22.5 16H28'), line('M25 13 28 16l-3 3')],

  /* Work lifted off the main line and handed back when it is done. */
  '@hyperfrontend/web-worker': [line('M4 8.5h24'), line('M4 23.5h24'), line('M11.5 8.5 20.5 23.5'), dot(16, 16, 2.6)],
}

/**
 * The mark shown for a package that has none of its own: the outline of a
 * package, which is the one thing every entry on the index is.
 *
 * It exists so a package added to the workspace before its mark is drawn still
 * renders an identity rather than a hole, and so no caller has to branch on
 * whether a mark exists.
 */
export const FALLBACK_MARK: PackageMark = [
  line('M16 4.2l10.2 5.9v11.8L16 27.8 5.8 21.9V10.1z'),
  line('M5.8 10.1 16 16l10.2-5.9'),
  line('M16 16v11.8'),
]
