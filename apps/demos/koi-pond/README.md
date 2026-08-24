# Koi Pond

Eight frameworks, eight separately built and separately deployed applications, swimming in
one continuous scene a visitor stocks by hand.

<!-- TODO(asset): short capture of a stocked pond, koi from several frameworks crossing, one held to its card, ripples crossing frames -->

A vanilla-TS **host** owns the pond: the bed, the surface water, the pointer, the depth
order, the roster, and one channel per koi. Each **fish** is an independently implemented
app (React, Vue, Svelte, SolidJS, Preact, Lit, Angular, and vanilla TS), mounted into its
own transparent frame and composited into the scene by nothing more than a shared camera
contract and a z-index. The pond host is itself a hostee the docs-site gallery mounts,
which makes the running demo the live **gallery → host/hostee → fish** nesting chain.

Every app consumes the **published** `@hyperfrontend/features`, exactly as an external
consumer would.

## What the seam proves

The eight apps share one simulation. `demo-koi-lib` owns the koi's body, its physics, its
steering brain, the frame loop that drives them, the wire plumbing that speaks the
contract, and the three.js stage that draws the animal. What each app owns is its
framework's **mounting, rendering, and lifecycle idiom**: React roots and refs, Solid
signals, a Vue SFC, Svelte runes, Lit shadow DOM driven by a `ReactiveController`, an
Angular zoneless `createApplication` mount, Preact, and hand-built DOM. The interesting
part is the seam: the same brain, observed and biased through typed hooks, expressed by
eight genuinely different component layers, over eight separate channels, from eight
separate builds.

Two more claims run alongside it:

- **The visitor composes the running system.** Koi are added and removed live, duplicates
  of one framework swim beside each other as distinct animals, and the host re-deals
  identity, depth, and relay membership around every change without disturbing the koi
  already swimming.
- **The composition adapts to what it is given.** The pond reads how it is mounted before
  it opens anything and opens the scene that fits, and it reads the device's capability
  and caps the shoal it will seat.

## Layout

| Path                                                       | Role                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `host/`                                                    | `demo-koi-pond`: pond bed, water, pointer, depth, relay, roster; hostee shell                         |
| `host/vendor/`                                             | the eight committed koi shell tarballs the host installs by `file:`                                   |
| `fish-<framework>/`                                        | `demo-koi-fish-<framework>`, one koi per framework: vanilla react vue svelte solid preact lit angular |
| `fish-<framework>/feature.config.ts`                       | each koi's shell packaging: contract, canonical origin, display modes, an explicitly open protocol    |
| `lib/src/model/`, `lib/src/geometry/`, `lib/src/contract/` | the pond's vocabulary, the wire, and the maths of the water                                           |
| `lib/src/motion/`                                          | the steering brain, its manoeuvre ladder, and the integrator that predicts a koi's own path           |
| `lib/src/runtime/`                                         | the frame loop every fish app composes: brain, renderer, contract, sleep and wake                     |
| `lib/src/koi3d/`                                           | the koi itself: build, anatomy, mesh generation, markings, and the spine that poses it. No renderer   |
| `lib/src/three/`                                           | the three.js adapter: materials, shaders, cameras, lighting, the koi stage, debug overlays            |
| `lib/src/styles/fish.css`                                  | the chrome every fish app shares: canvas, identity card, links                                        |
| `lib/src/solo/`                                            | the page a fish app dresses for itself when nothing is hosting it, and a mark per framework           |
| `workbench/`                                               | `demo-koi-workbench`: the koi model's development environment. Never deployed                         |
| `vendor/`                                                  | the committed `demo-koi-lib` tarball its consumers install by `file:`                                 |
| `tools/refresh-lib.mjs`                                    | rebuilds, repacks and reinstalls the lib into every consumer in one pass                              |

## How the pond composes

- **Two contracts.** The inner contract (`lib/src/contract/koi-fish.contract.ts`, 0.8.0)
  runs between the pond host and each koi: the host announces the world (`pond`), the
  koi's identity, relayed neighbours, disturbances, depth grants, hover, sleep, a hold
  (`pause`), and a placement while a held koi is carried; the koi answers with its
  outline, depth and ripple requests, and a settled signal. The outer contract
  (`host/koi-pond.contract.ts`, 0.2.0) runs between the gallery and the pond:
  `set-scene`/`disturb` in, `shoal`/`sequence-complete`/`close-request` out. The pond
  re-emits `shoal` as a ten-second roll call even when nothing changed: an embedder
  watching for signs of life must never read a calm pond as an outage. The gallery is
  never told how many apps are behind the scene, or that there is more than one.
- **Eight features, eight shells.** Each koi is packaged exactly like any other feature:
  its `feature.config.ts` names the contract (a re-export of the shared library's), its
  canonical origin, and its display modes, and `pack-shell` emits a typed shell package
  the host vendors and installs. The pond opens every koi through its generated shell.
  While the pond deploys composed on one origin, the host overrides each shell's baked URL
  with the `/fish-<name>/` sub-path (`COMPOSED_DEPLOYMENT` in
  `host/src/scene/koi-sessions.ts`); provisioning the per-koi services and flipping that
  flag is the whole migration to separate origins.
- **Every session is an instance.** The host keys layers, roster rows, relay membership,
  depth slots, retries, resurrection budgets, and held chrome by a `framework:ordinal`
  instance id, never by framework. That is what lets two React koi swim in one pond as two
  animals: they are dealt different variant seeds, so they are the same species in the
  same colours wearing different bodies, and they avoid each other like any other pair.
  The wire never sees the id; the host converts at the channel boundary.
- **A stable virtual pond.** `PondEnvironment.width/height` is the virtual pond, decided
  once when the scene opens; `pond.view` is the window the presenting frame currently
  shows, centred on the pond and recomputed on every resize. Simulation, spawning and
  steering read the world; cameras, canvases, culling and the pointer read the view.
  Resizing a frame never rebuilds the world underneath the fish. A koi app that may yet be
  framed builds a world from its own screen so it can swim before anything answers it, and a
  koi told of a world of other dimensions enters that one instead: the station it took in a
  world it invented means nothing in the one it was given. A koi told it is top-level will
  never be told anything, so its world is the window it was opened in: nothing is coming to
  correct it, and a screen-derived world would send the fish off to swim in the part of it
  nobody is looking at.
- **One camera, N renders.** Every fish builds the same camera from the pond announcement
  (`lib/src/model/pond-view.ts` holds the numbers, `lib/src/three/pond-view.ts` the
  builder): ~10° tilt, agreed px-per-unit at the swim plane, `pond` lighting,
  ACESFilmic/1.15. Independent transparent `WebGLRenderer`s therefore composite as one
  scene.
- **Each koi renders only its own water.** A fish's canvas covers just its frame box (a
  square around its own body), and the shared camera is narrowed onto that box
  (`setViewOffset`), so the small canvas paints pixel-identically what a full-viewport
  render would have put there. The canvas slides with the fish on a compositor transform;
  a koi outside the visible window draws nothing at all. A shoal of viewport-sized
  antialiased framebuffers was the pond's real memory and fill bill, and this is what
  replaced them.
- **The host paints the water on one small context.** The bed is a still canvas-2D
  painting, refreshed only on resize; the moving surface (the caustic web, the ripple
  crests, and a slower, brighter, barely-there veil that reads as the water's own skin over
  the fish) is one fragment shader on the host's single WebGL context, rendered below
  device resolution because water is soft, with the old canvas-2D painter kept as an
  automatic fallback (which skips the veil on purpose: the fallback's whole point is its
  minimum per-frame cost). Every 2D surface the host paints is capped at 2x device pixel
  ratio, the same ceiling the WebGL surfaces already lived by.

  That context is also the first thing a browser reclaims from a tab left in the background,
  and it is the koi themselves that usually cost it: they give their own contexts back when
  they sleep and build fresh ones on waking, and somewhere in that exchange the water's is
  dropped. So the painter asks for it back, which is the only way a browser will ever offer
  one, and the pond gives it a second and a half to arrive. If none does, the whole canvas is
  replaced and the water built again on a new one, because a context that is lost and not
  restored can never be replaced on the element that held it. A visitor who leaves the tab
  and comes back gets water either way.

- **Depth is z-index.** Seven logical depth levels map to the stacking order of host-owned
  containers; passing above or below a neighbour requires a granted two-level shift with a
  cooldown, and the surface water always paints topmost. The spread is re-dealt from the
  living roster on every join and leave, so a lone koi holds the surface and a crowded pond
  doubles koi up on levels. Each koi carries its own contact shadow, so the upper fish's
  shadow falls across whatever swims beneath it.
- **The host owns the pointer.** Every koi frame is `pointer-events: none`; the host runs
  one normalized stream, hit-tests against fish-reported outlines, and tells the winner.
  Hovering traces a soft silhouette; pressing a fish holds it in place for inspection and
  opens its identity card, and dragging a held fish carries it to a new spot in the water;
  pressing open water strikes it, ripples the surface, and scatters the shoal. Picking a
  different fish releases the held one first: one inspection at a time. A fingertip gets
  the same experience as a cursor: taps hit-test with widened slack, and the card clamps
  itself into the visible window.
- **A koi's life is scheduled, not noisy.** Each fish swims legs of a seeded itinerary at a
  seeded pace: loafs, brisk stretches, and rare bursts arrive as discrete bounded events
  that never stack; a change of course is a turn that begins, runs its arc, and ends into a
  cooldown. Roughly one waypoint in ten deliberately crosses the visible window, so
  trajectories keep passing through the water a visitor is actually looking at without ever
  fencing the fish in. And roughly one boundary approach in five is ignored outright: the
  koi slips out past the hard edge, disappears for about five seconds, and re-enters from
  the opposite side: the same fish leaving one bank and coming back from another.
- **Manoeuvres are costed.** An avoidance commits the least effort predicted to clear the
  obstacle, from three tiers (a lean, an ordinary break, a committed break) unlocked by how
  many seconds away the crossing is. It breaks toward whichever flank the surrounding water
  reads clearer and, when the two read the same, toward its right on a seeded draw, so two
  koi meeting head-on read identical water and still break apart. And it brakes in
  proportion to the helm it wound on, so a koi slows into a turn and picks its pace back up
  coming out of it.
- **Coordination is relayed, never broadcast.** Fish report compact spine outlines at a low
  cadence; the host broad-phase filters and relays each fish only its nearby neighbours,
  dead-reckoning stale reports forward along their own headings. The inner channels run as
  explicitly **open shells**: a per-message security envelope across many high-cadence
  channels collapses delivery, so each koi's feature config declares `protocol: 'none'` and
  its shell is packed with that acknowledged. The single gallery to pond channel keeps
  protocol `v1`; that is the real cross-site boundary today.
- **Identity is seeded.** Every reproducible trait (behaviour, build, phenotype, swim trim,
  markings, entry station) derives from one integer seed per instance through
  `randomPseudo`, so the same fish appears on every reload and the host and fish agree on
  its size without exchanging a message. Each framework wears a real nishikigoi variety
  whose dominant marking is its brand colour; the whites, sumi blacks and oranges are the
  variety's own and mean nothing.

## The shoal

The roster is the pond's control surface, a panel over the water that contains its own
presses so a click on it never strikes the pond. Every framework keeps a row whether or not
one of its koi is swimming: a presence dot, its name linked to that fish's app, a count
badge, an add control, and a nested list of that framework's living koi, each with its own
numbered remove control. Focus is the keyboard's hover: a framework's name lights every
answering koi of that framework, one koi's remove control lights that koi alone.

The ceiling is stated rather than merely enforced. `readDeviceProfile()` reads
`navigator.deviceMemory` and `navigator.hardwareConcurrency` (capability signals only, no
user-agent sniffing) and returns a tier and a cap: **low** seats 4 (at most 2GB or at most
2 cores), **high** seats 12 (at least 8GB and at least 8 cores), and **middle** seats 8,
which is also where any device that withholds either signal lands. The low gate is
deliberately narrow: it is meant for a device that will drop frames whatever the pond does,
not for an ordinary machine reporting a modest core count, because what a device is asked to
hold at once is the opening band rather than the cap. At the ceiling every add
control disables and names the tier; below it the note line counts the room left. The last
koi's remove control disables too: the pond is never empty. Since eight frameworks share
the pond, duplicates are reachable only above eight, which makes the cap the only mechanism
governing them.

The "View interactions" control lives in the panel, and so does the link to the pond's own
source. Under 680px the panel collapses to a pill rather than hiding, so a phone in the full
scene keeps every gesture.

## Presentation

The pond decides what it is before it opens anything. `feature.hosted` is known
synchronously, so a top-level visit opens the full scene in the same tick as boot, while a
mounted pond holds its water empty until its host says what it mounted: the first
`set-scene` names the scene, a presentation in any mode but embedded reads as full at once,
and a host that never sends scene semantics forfeits its say after one second.

Two profiles come out of that decision, and an instance never morphs between them. A
contradicting `set-scene` after the fact is diagnosed and ignored; a host whose presentation
genuinely changes destroys the pond and opens it again.

- **Card**: one koi, rotating by the hour of day, in a world derived from the card's own
  frame rather than from the device screen, seated in the middle of it and held resting from
  the moment it opens. It sculls in place and carries no chrome at all: a card is an
  invitation to expand. Releasing a held card koi returns it to the resting hold, never to
  travel. The bed paints solid, with its outermost edges thinning toward half transparency
  along the card's rounded corners, so the water sits _in_ the card rather than reading as a
  square image pasted onto it.
- **Full**: the hour-anchored koi and the frameworks after it in list order, in the
  screen-derived world, so an expand reads as the same koi with company, and the visitor
  stocks the pond from there. How many come with it is the frame's own to answer: a full
  desktop window opens eight, an ordinary window five, a phone three, and anything barely
  larger than a card just one, always bounded by what the device seats. The bed paints at
  ~70% opacity so the page beneath stays perceptible.

Escape inside the pond releases a held koi if there is one, and otherwise asks the host to
close; the host owns the presentation and answers with `set-scene`, which is also what
re-arms the next request.

## One fish, opened on its own

Every koi is a whole application, and every one of them has a URL. Follow it and the app
answers on its own terms: the runtime is told nothing is hosting it, so it swims a world the
size of the window rather than one derived from the screen behind it, paints its own water,
and names the framework that drew it beside a mark in that project's colour, a sentence on
how that framework mounts and drives this particular fish, the contract it speaks, and links
on to the framework, to this app's own source, and to the pond that composes all eight.

None of it exists inside the pond. The chrome is mounted only when the app states it is
top-level, and any pond announcing a world takes it straight back down, because water
painted inside a framed koi would blank every koi below it. An app that says nothing either
way is treated as hosted: a bare page on a direct visit is a missed opportunity, while a
painted page inside a frame is a broken pond.

## The interaction overlay

"View interactions" draws what each koi is deciding, in one ink at varying alpha. Nothing in
the overlay is colour-coded: an escape and a depth pass read from the shape of the path and
the motion of the caret, not from a hue.

- A **perception field**: the very region the koi's own narrow phase judges a crossing in,
  from the two numbers it reports for it, so a neighbour inside the mark is a neighbour the
  animal is actually weighing. It hangs from the nose the koi judges from and opens ahead of
  it, which is what keeps it off the body at every build. The two numbers are its two axes,
  the reach along the heading and the clearance across it, and the ink inside is one gradient
  poured from a point near the animal, so it thins away in every direction at once and
  reaches nothing exactly where the koi stops caring. What the arithmetic keeps and the mark
  gives up are the corners of that region, which lie where the ink had already run out. What
  it cannot show at all is depth: a koi drawn inside another's field may be passing two
  levels underneath it.

  The shape is the simulation's rather than the animal's. A real fish sees almost all the way
  around itself; this one has no view angle at all, and judges a neighbour by where the pair
  of them will be a couple of seconds from now, which is a corridor along its course rather
  than a cone out of its eyes.

- A **pearl trace**: the koi's own predicted advancement, drawn as stationary dots at a
  fixed spacing along its body length, brightest at the nose and fading toward the horizon.
  A pearl never moves once placed. The nose consumes the pearls it passes, fresh ones are
  minted at the far end, and a decision that invalidates the path cuts the trace from the
  first pearl that no longer lies on it.
- A **double chevron** orbiting the head, sized and stood off from the body the koi
  reported, which slides toward the heading it has committed to faster than any helm the koi
  has, so it arrives before the body does and the gap between the two closes as the animal
  swings onto it. The koi answers only for the arc its own helm carries it through in the
  seconds just ahead, so nothing is ever announced that then fails to happen. Its weight is
  how hard the koi is committed: a drift between turns wears a whisper of a mark and a
  decided manoeuvre a firm one. Its core fills once that manoeuvre is an avoidance, which is
  how a koi that has noticed something and broken for it reads apart from one merely
  swimming somewhere.

A held koi reports no intent and draws nothing.

## Diagnostics

`?vitals=1` (remembered per origin until `?vitals=0`) mounts an opt-in overlay above
everything: one probe row per living koi, labelled by instance, arriving and leaving with
the roster; a boot record stating cores, memory, tier and cap beside the screen facts; and a
log of session events, roster changes, cap refusals and visibility transitions, persisted in
`localStorage` so it survives the page death it was armed to explain. The overlay also puts
the scene handle on `window.koiPond`, which is how a device-evidence session drives the
shoal from a console.

## The koi model

`lib/src/koi3d/anatomy.ts` is the file to edit when a koi is the wrong shape. Every row is
one cross-section along the body: how wide it is, how far it reaches above and below its own
axis, and how square or pinched that section is. The head is a broad flattened wedge, the
shoulder the widest station, the midships a dorsally weighted oval, the peduncle a blade.
Rows interpolate with monotone cubic segments, so editing one never introduces a bulge its
neighbours did not ask for, and the mesh generators do nothing but loft the result.

- **Deformation is `spine(t, s)`.** The pose is built from _curvature_ and then integrated,
  which is what conserves the koi's length: a fish bent double is exactly as long as one
  swimming straight. Every vertex carries the station it belongs to and is carried rigidly by
  that station's frame, so a hard turn bends the body without squashing any section of it.
  The CPU writes two small uniform arrays a frame and never touches a vertex. Curvature fades
  out at both ends for the same reason it exists: the skull is bone, and the caudal blade past
  the peduncle is a rayed membrane, carried and lagging, but not coiling. A blade that took the
  body's own curvature would roll its fork onto its edge every beat, and a fork seen edge-on
  from above the water is a fish with no tail.
- **Behaviour, not animation.** A consumer says `speed`, `turnRate`, `escapeIntensity`,
  `depth`; the swim model turns those into curvature, easing every parameter on its own time
  constant. Positive `turnRate` turns clockwise on screen (the same direction a growing pond
  heading turns), so a brain feeds the heading's own rate straight in and the head leads into
  the turn. Tail-beat amplitude is calibrated against measured tail sweep, about a fifth of a
  body length at cruise, which is what a carp actually does, and what rises with speed is
  mostly the frequency.
- **Markings are generated.** Patches live in `(station, girth)` coordinates, so they wrap
  over the shoulder and down the flank, hold still while the body flexes underneath them, and
  have no seam anywhere. Every patch derives from the koi's seed, so the same seed is always
  the same fish.
- **Surface detail is a bump, not triangles.** The scale relief is evaluated per pixel in body
  coordinates, runs in proper diagonal courses, and stops at the operculum, because a koi's
  head is scaleless.

Nothing above `lib/src/three/` knows what a renderer is. The generators emit typed arrays,
the pose model emits a bent curve, the pattern generator emits a list of markings; only the
adapter turns any of that into buffers and materials. `three` is an **optional peer
dependency** reached through the package's `./three` entry point, so a consumer that only
wants the model never installs a renderer, and one that does owns its own copy for its
bundler to dedupe.

## The workbench

```bash
npx nx run demo-koi-workbench:dev     # http://localhost:4283
```

Leave it running and edit anything under `lib/src/`. The workbench resolves
`@hyperfrontend/demo-koi-lib` straight to the library's TypeScript sources through a Vite
alias and a tsconfig path, so a geometry change type-checks and hot-reloads with **no
repack**; it is the one consumer the refresh rule below does not apply to.

One koi, centred, near-overhead, on a neutral field. The right-hand column carries the camera
(production and orbit modes, angle, swing, zoom, backdrop, lighting), the geometry knobs for
body, head, eyes, fins and tail, the movement presets and their trim, freeze-and-scrub,
appearance, depth, debug overlays and tessellation. **R** returns to the production camera
from anywhere; **space** pauses. The readout reports frames per second, triangles, vertices,
draw calls and pose time.

Debug overlays (spine, stations, cross-sections, normals, bounds, collision chain, heading,
awareness cone) are off by default and add nothing to the scene until asked for.

## Running the pond

```bash
npx nx run demo-koi-pond:dev-hosted    # composed pond on :4282, hf debug UI on :4290
npx nx run-many -t build -p demo-koi-* # composed site → dist/apps/demos/koi-pond/site
npx http-server dist/apps/demos/koi-pond/site -p 4288   # serve the built site (plain static)
```

The composed site puts the host at `/` and each fish at `/fish-<framework>/`: one origin in dev
and in production alike. **Never serve the built site through a SPA rewrite** (`serve -s` or any
fallback-to-index): every missing `/fish-<framework>/` request would come back as a nested copy
of the whole pond. Deployment is one Railway service on the GitHub integration, redeploying on
merge to `main`; the build context must include `vendor/`. Each fish additionally declares its
canonical standalone service in its `project.json` `metadata.deploy`; until those services are
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
live chain is three deep: docs site → pond → koi. A koi policy naming only the pond therefore
blanks the whole shoal in the gallery. Listing both the pond and the docs site is also what makes
one value correct before and after the `COMPOSED_DEPLOYMENT` flip: while composed the pond is the
koi's own origin (`'self'`), and afterwards it is the named pond origin. The pond's config carries
the koi override as a later rule with `"prefix": "/fish-"`: rules apply in order and a later rule
overrides an earlier one, one header at a time.

## Working on it

```bash
npx nx run demo-koi-workbench:dev      # the model workbench on :4283, with HMR onto lib/src
npx nx test demo-koi-lib               # the model, motion, runtime, geometry and contract specs
npx nx test demo-koi-pond              # the scene, panel, overlay, resurrection and vitals specs
npx nx run demo-koi-lib:build          # emit the published surface into lib/dist
npx nx run demo-koi-lib:refresh        # rebuild + repack the shared lib into every consumer
npx nx run demo-koi-lib:verify         # fail loudly when the tarball or a consumer lock has drifted
npx nx run demo-koi-pond:refresh-fish-shells   # repack all eight koi shells + reinstall into the host
npx nx run-many -t=lint,typecheck -p demo-koi-*
```

**Always run `demo-koi-lib:refresh` after touching `lib/src`.** A bare `npm install` will not
re-resolve a `file:` tarball whose path has not changed: with a warm cache it reports "up to date"
and installs the previous contents. `refresh` installs by explicit path, which is the only invocation
that re-reads the tarball; `verify` turns the silent staleness into a loud failure.

**Run `demo-koi-pond:refresh-fish-shells` after changing the koi contract or any fish's
`feature.config.ts`.** It repacks all eight shells and reinstalls them into the host by explicit
path, for the same staleness reason. It never prunes, so a version bump leaves the previous
tarballs behind to be deleted by hand. The vendored tarballs in `host/vendor/`, the host's
`package.json`, and its `package-lock.json` always land in the same commit: a repacked tarball
without its lockfile update fails `npm ci` with EINTEGRITY on a cold cache.

The fish apps carry no unit tests by design. Every behaviour they compose is specified in
`demo-koi-lib`, whose suites are mutation-proven, and the eight apps are evidence of the
composition rather than of the simulation.

A few constraints the scene depends on:

- **Fish apps must paint nothing on `body` or their root**: any paint blanks the pond behind
  that frame for every koi below it.
- **GL contexts are the budget: one per koi, one for the host's water.** Each fish bundles its
  own copy of `three` (a shared chunk would need a shared origin and break the isolation the demo
  exists to prove), and each renders only its own frame box, so the budget is counted in
  fish-sized buffers, not viewports. A hidden page gets its contexts back: sleeping disposes each
  renderer, and waking rebuilds them staggered by ordinal so a returning shoal never creates every
  context in one frame.
- **The curtain covers the staggered reveal.** Frames stay hidden until each session opens; the
  host lifts the curtain when the last of the opening shoal lands, or at a deadline so an
  unreachable fish cannot hold the pond dark.
- **A dead frame is healed, not left standing.** A browser that kills a koi's frame repaints it
  with its own crash tile, which no host page can style. A session whose unresponsive verdict
  outlives its grace is destroyed (which takes the tile with it) and reopened on a backoff, on a
  bounded budget, and never into a hidden page.
- **`KOI_FRAMEWORKS` and every trait band are append-only.** A koi's list position is its seed, so
  reordering the list re-rolls every fish in the pond.
