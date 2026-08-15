# Koi Pond

Seven koi, seven separate applications, seven frameworks — swimming in one continuous scene.

A vanilla-TS **host** owns the pond: the bed, the surface water, the pointer, the depth order,
and the seven channels. Each **fish** is an independently implemented app — React, Vue, Svelte,
SolidJS, Preact, Lit, and vanilla TS — mounted into its own transparent full-viewport frame and
composited into the scene by nothing more than a shared camera contract and a z-index. The pond
host is itself a hostee the docs-site gallery mounts, which makes the running demo the live
**gallery → host/hostee → fish** nesting chain.

Every app consumes the **published** `@hyperfrontend/features`, exactly as an external consumer
would. The shared library below is a vocabulary — model, contracts, geometry, the renderer-free
3D koi — never a simulation engine: each fish composes those primitives into its own swimming
brain and its own renderer, in its own framework's idiom. That independence is what the demo
exists to show.

## Layout

| Path                                                       | Role                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `host/`                                                    | `demo-koi-pond` — pond bed, water, pointer, depth, relay, playground controls; hostee shell          |
| `host/vendor/`                                             | the seven committed koi shell tarballs the host installs by `file:`                                  |
| `fish-<framework>/`                                        | `demo-koi-fish-<framework>` — one koi per framework: vanilla react vue svelte solid preact lit       |
| `fish-<framework>/feature.config.ts`                       | each koi's shell packaging — contract, canonical origin, display modes, an explicitly open protocol  |
| `lib/src/model/`, `lib/src/geometry/`, `lib/src/contract/` | the pond's vocabulary, the wire, and the maths of the water                                          |
| `lib/src/koi3d/`                                           | the koi itself — build, anatomy, mesh generation, markings, and the spine that poses it. No renderer |
| `lib/src/three/`                                           | the three.js adapter: materials, shaders, cameras, lighting, debug overlays                          |
| `workbench/`                                               | `demo-koi-workbench` — the koi model's development environment. Never deployed                       |
| `vendor/`                                                  | the committed `demo-koi-lib` tarball its consumers install by `file:`                                |
| `tools/refresh-lib.mjs`                                    | rebuilds, repacks and reinstalls the lib into every consumer in one pass                             |

## How the pond composes

- **Two contracts.** The inner contract (`lib/src/contract/koi-fish.contract.ts`) runs between
  the pond host and each koi: the host announces the world (`pond`), identity, relayed
  neighbours, disturbances, depth grants, hover, sleep, click-to-inspect (`pause`) and the
  playground (`tune`); the koi answers with its outline, depth and ripple requests, and a
  settled signal. The outer contract (`host/koi-pond.contract.ts`) runs between the gallery and
  the pond: `set-scene`/`disturb` in, `shoal`/`sequence-complete`/`close-request` out. The
  gallery never learns there are seven apps inside.
- **Seven features, seven shells.** Each koi is packaged exactly like any other feature: its
  `feature.config.ts` names the contract (a re-export of the shared library's), its canonical
  origin, and its display modes, and `pack-shell` emits a typed shell package the host vendors
  and installs. The pond opens every koi through its generated shell. While the pond deploys
  composed on one origin, the host overrides each shell's baked URL with the `/fish-<name>/`
  sub-path (`COMPOSED_DEPLOYMENT` in `host/src/scene/koi-sessions.ts`); provisioning the
  per-koi services and flipping that flag is the whole migration to separate origins.
- **A stable virtual pond.** `PondEnvironment.width/height` is the virtual pond, snapshotted
  once from the screen when the scene opens; `pond.view` is the window the presenting frame
  currently shows, centred on the pond and recomputed on every resize. Simulation, spawning and
  steering read the world; cameras, canvases, culling and the pointer read the view. A gallery
  card, the expanded overlay, and the `hf dev` debug panel are different windows onto the same
  water — resizing a frame never rebuilds the world underneath the fish.
- **One camera, seven renders.** Every fish builds the same camera from the pond announcement
  (`lib/src/model/pond-view.ts` holds the numbers, `lib/src/three/pond-view.ts` the builder):
  ~10° tilt, agreed px-per-unit at the swim plane, `pond` lighting, ACESFilmic/1.15. Seven
  independent transparent `WebGLRenderer`s therefore composite as one scene; the host itself
  stays GL-free (its bed and surface are canvas-2D).
- **Depth is z-index.** Seven logical depth levels map to the stacking order of host-owned
  containers; passing above or below a neighbour requires a granted two-level shift with a
  cooldown, and the surface water always paints topmost. Each koi carries its own contact
  shadow, so the upper fish's shadow falls across whatever swims beneath it.
- **The host owns the pointer.** Every koi frame is `pointer-events: none`; the host runs one
  normalized stream, hit-tests against fish-reported outlines, and tells the winner. Hovering
  reveals a fish's framework and app URL; clicking a fish holds it in place for inspection
  (it sculls, keeps reporting, and resumes on the next click); clicking open water strikes it,
  ripples the surface, and scatters the shoal.
- **Coordination is relayed, never broadcast.** Fish report compact spine outlines at a low
  cadence; the host broad-phase filters and relays each fish only its nearby neighbours,
  dead-reckoning stale reports forward along their own headings. The seven inner channels run
  as explicitly **open shells** — a per-message security envelope across seven high-cadence
  channels collapses delivery, so each koi's feature config declares `protocol: 'none'` and its
  shell is packed with that acknowledged. The single gallery ↔ pond channel keeps protocol
  `v1` — that is the real cross-site boundary today.
- **Identity is seeded.** Every reproducible trait — behaviour, build, phenotype, swim trim,
  markings, entry station — derives from one integer seed per framework through
  `randomPseudo`, so the same fish appears on every reload and the host and fish agree on its
  size without exchanging a message. Each framework wears a real nishikigoi variety whose
  dominant marking is its brand colour; the whites, sumi blacks and oranges are the variety's
  own and mean nothing.

## Presentation

In the gallery the card is a small window onto the running pond, inviting **click to expand**;
expansion restyles the same embed into a viewport overlay — same session, same iframe, no
teardown — with close/Escape/next-demo chrome. Expanded (and standalone), the pond paints its
bed at ~70% opacity so the page beneath stays perceptible; in the card it paints solid. The
host's playground panel exposes a curated set of live levers (pace, agility, wander, spacing,
body wave, beat, wave reach, girth, body depth) that broadcast `tune` scales each fish lays
over its own derived numbers.

## The koi model

`lib/src/koi3d/anatomy.ts` is the file to edit when a koi is the wrong shape. Every row is one
cross-section along the body — how wide it is, how far it reaches above and below its own axis, and
how square or pinched that section is. The head is a broad flattened wedge, the shoulder the widest
station, the midships a dorsally weighted oval, the peduncle a blade. Rows interpolate with monotone
cubic segments, so editing one never introduces a bulge its neighbours did not ask for, and the mesh
generators do nothing but loft the result.

- **Deformation is `spine(t, s)`.** The pose is built from _curvature_ and then integrated, which is
  what conserves the koi's length: a fish bent double is exactly as long as one swimming straight.
  Every vertex carries the station it belongs to and is carried rigidly by that station's frame, so
  a hard turn bends the body without squashing any section of it. The CPU writes two small uniform
  arrays a frame and never touches a vertex.
- **Behaviour, not animation.** A consumer says `speed`, `turnRate`, `escapeIntensity`, `depth`; the
  swim model turns those into curvature, easing every parameter on its own time constant. Positive
  `turnRate` turns clockwise on screen — the same direction a growing pond heading turns — so a
  brain feeds the heading's own rate straight in and the head leads into the turn. Tail-beat
  amplitude is calibrated against measured tail sweep — about a fifth of a body length at cruise,
  which is what a carp actually does — and what rises with speed is mostly the frequency.
- **Markings are generated.** Patches live in `(station, girth)` coordinates, so they wrap over the
  shoulder and down the flank, hold still while the body flexes underneath them, and have no seam
  anywhere. Every patch derives from the koi's seed, so the same seed is always the same fish.
- **Surface detail is a bump, not triangles.** The scale relief is evaluated per pixel in body
  coordinates, runs in proper diagonal courses, and stops at the operculum, because a koi's head is
  scaleless.

Nothing above `lib/src/three/` knows what a renderer is. The generators emit typed arrays, the pose
model emits a bent curve, the pattern generator emits a list of markings; only the adapter turns any
of that into buffers and materials. `three` is an **optional peer dependency** reached through the
package's `./three` entry point, so a consumer that only wants the model never installs a renderer,
and one that does owns its own copy for its bundler to dedupe.

## The workbench

```bash
npx nx run demo-koi-workbench:dev     # http://localhost:4283
```

Leave it running and edit anything under `lib/src/`. The workbench resolves
`@hyperfrontend/demo-koi-lib` straight to the library's TypeScript sources through a Vite alias and a
tsconfig path, so a geometry change type-checks and hot-reloads with **no repack** — it is the one
consumer the refresh rule below does not apply to.

One koi, centred, near-overhead, on a neutral field. The right-hand column carries the camera
(production and orbit modes, angle, swing, zoom, backdrop, lighting), the geometry knobs for body,
head, eyes, fins and tail, the movement presets and their trim, freeze-and-scrub, appearance, depth,
debug overlays and tessellation. **R** returns to the production camera from anywhere; **space**
pauses. The readout reports frames per second, triangles, vertices, draw calls and pose time.

Debug overlays — spine, stations, cross-sections, normals, bounds, collision chain, heading,
awareness cone — are off by default and add nothing to the scene until asked for.

## Running the pond

```bash
npx nx run demo-koi-pond:dev-hosted    # composed pond on :4282, hf debug UI on :4290
npx nx run-many -t build -p demo-koi-* # composed site → dist/apps/demos/koi-pond/site
npx http-server dist/apps/demos/koi-pond/site -p 4288   # serve the built site (plain static)
```

The composed site puts the host at `/` and each fish at `/fish-<framework>/` — one origin in dev
and in production alike. **Never serve the built site through a SPA rewrite** (`serve -s` or any
fallback-to-index): every missing `/fish-<framework>/` request would come back as a nested copy
of the whole pond. Deployment is one Railway service on the GitHub integration, redeploying on
merge to `main`; the build context must include `vendor/`. Each fish additionally declares its
canonical standalone service in its `project.json` `metadata.deploy` — until those services are
provisioned and `COMPOSED_DEPLOYMENT` is flipped, the composed service serves every koi as a
sub-path and the shells' baked origins stay dormant.

**A koi is only ever framed from its directory URL** (`…/fish-<framework>/`, never
`…/index.html`). Its assets are referenced relatively so that one build serves both the pond's
sub-path and the koi's own origin root; a static host that rewrites `…/index.html` to an
extensionless path leaves the document one directory up, where every relative asset misses and
the koi never boots.

### Who may frame what

Each service ships an `hf-serve.config.json` from its `public/` directory, so the policy travels
with the artifact instead of living in a dashboard (`hf serve` picks it up from the served root):

| Served root                   | `frame-ancestors`                             |
| ----------------------------- | --------------------------------------------- |
| the pond (`site/`)            | the docs site (and Vercel previews of it)     |
| every koi (`site/fish-<fw>/`) | the pond **and** the docs site, plus `'self'` |

`frame-ancestors` is checked against **every** ancestor, not just the immediate parent, and the
live chain is three deep — docs site → pond → koi. A koi policy naming only the pond therefore
blanks the whole shoal in the gallery. Listing both the pond and the docs site is also what makes
one value correct before and after the `COMPOSED_DEPLOYMENT` flip: while composed the pond is the
koi's own origin (`'self'`), and afterwards it is the named pond origin. The pond's config carries
the koi override as a later rule with `"prefix": "/fish-"` — rules apply in order and a later rule
overrides an earlier one one header at a time.

## Working on it

```bash
npx nx run demo-koi-workbench:dev      # the model workbench on :4283, with HMR onto lib/src
npx nx test demo-koi-lib               # the geometry, pose, pattern and configuration specs
npx nx run demo-koi-lib:build          # emit the published surface into lib/dist
npx nx run demo-koi-lib:refresh        # rebuild + repack the shared lib into every consumer
npx nx run demo-koi-lib:verify         # fail loudly when the tarball or a consumer lock has drifted
npx nx run demo-koi-pond:refresh-fish-shells   # repack all seven koi shells + reinstall into the host
npx nx run-many -t=lint,typecheck -p demo-koi-*
```

**Always run `demo-koi-lib:refresh` after touching `lib/src`.** A bare `npm install` will not
re-resolve a `file:` tarball whose path has not changed — with a warm cache it reports "up to date"
and installs the previous contents. `refresh` installs by explicit path, which is the only invocation
that re-reads the tarball; `verify` turns the silent staleness into a loud failure.

**Run `demo-koi-pond:refresh-fish-shells` after changing the koi contract or any fish's
`feature.config.ts`.** It repacks all seven shells and reinstalls them into the host by explicit
path, for the same staleness reason. The vendored tarballs in `host/vendor/`, the host's
`package.json`, and its `package-lock.json` always land in the same commit — a repacked tarball
without its lockfile update fails `npm ci` with EINTEGRITY on a cold cache.

A few constraints the scene depends on:

- **Fish apps must paint nothing on `body` or their root** — any paint blanks the pond behind
  that frame for every koi below it.
- **Seven GL contexts is the budget, and it belongs to the fish.** The host stays off WebGL, and
  each fish bundles its own copy of `three` — a shared chunk would need a shared origin and break
  the isolation the demo exists to prove.
- **The curtain covers the staggered reveal.** Frames stay hidden until each session opens; the
  host lifts the curtain when the seventh koi lands, or at a deadline so an unreachable fish
  cannot hold the pond dark.
