# Koi Pond

The shared koi model, and the workbench it is developed in.

A koi here is a lofted 3D mesh, not an illustration: a table of cross-sections is swept into one
continuous shell, bent every frame by a spine the GPU carries the vertices along, and painted by
markings that live in the animal's own coordinates rather than in a texture. One fish costs about
7,300 triangles in three draw calls.

The pond this model swims in is not in the tree yet. What is here is the library and the tool for
looking at it.

## Layout

| Path                                                       | Role                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `lib/src/model/`, `lib/src/geometry/`, `lib/src/contract/` | the pond's vocabulary, the wire, and the maths of the water                                          |
| `lib/src/koi3d/`                                           | the koi itself — build, anatomy, mesh generation, markings, and the spine that poses it. No renderer |
| `lib/src/three/`                                           | the three.js adapter: materials, shaders, cameras, lighting, debug overlays                          |
| `workbench/`                                               | `demo-koi-workbench` — the model's development environment. Never deployed                           |
| `vendor/`                                                  | the committed `demo-koi-lib` tarball its consumers install by `file:`                                |
| `tools/refresh-lib.mjs`                                    | rebuilds, repacks and reinstalls the lib into every consumer in one pass                             |

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
  swim model turns those into curvature, easing every parameter on its own time constant. Tail-beat
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

## Working on it

```bash
npx nx run demo-koi-workbench:dev      # the model workbench on :4283, with HMR onto lib/src
npx nx test demo-koi-lib               # the geometry, pose, pattern and configuration specs
npx nx run demo-koi-lib:build          # emit the published surface into lib/dist
npx nx run demo-koi-lib:refresh        # rebuild + repack the shared lib into every consumer
npx nx run demo-koi-lib:verify         # fail loudly when the tarball or a consumer lock has drifted
npx nx run-many -t=lint,typecheck -p demo-koi-*
```

**Always run `demo-koi-lib:refresh` after touching `lib/src`.** A bare `npm install` will not
re-resolve a `file:` tarball whose path has not changed — with a warm cache it reports "up to date"
and installs the previous contents. `refresh` installs by explicit path, which is the only invocation
that re-reads the tarball; `verify` turns the silent staleness into a loud failure.
