import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { galtonStage } from '../src/galton/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('random-generator-utils')

/** How many columns each board bins its draws into. */
const COLUMNS = 24

/** The digit a column index is written as, so a run of hundreds of draws fits on one line. */
const DIGITS = '0123456789abcdefghijklmn'

/**
 * The column each of 340 draws of `uniform(0, 100)` fell into, in draw order.
 *
 * Drawn from the real generator on 2026-09-12, from the workspace root, with
 * `npx tsx --tsconfig tsconfig.base.json` over a one-off script that opened
 * `createRandomGenerator(2026)`, took 340 `uniform(0, 100)` values and then
 * 340 `gaussian(0, 100)` values from that one stream, and binned each as
 * `floor(v / 100 * 24)` clamped to 0..23. One base-24 digit per draw.
 */
// note: seed 2026, drawn 2026-09-12 with `npx tsx --tsconfig tsconfig.base.json` from the workspace root; the uniform draws come first because both methods share the seeded stream
const UNIFORM =
  'a7fe35gj711e92479md046immi6696fk7m108ih9ngf80n4nj6b4nekiebciidgn8041mm44be6ml0nel5ed0lknj0mmbb05jld42bnk57hk4em1d3fe4573l8198lkfh85b512n3jn2447l260edn8cdglc9fh38aa2481ab456gg725kmlh469nd7nbacii4n32823070ga1e19198bddk9a3hjjf7hh3hgc2ncccehm99hl0nd47mdklmm68g38gak74gki5c0c3jcfcm8anmlcknm03d52a2d2kd9e43eclj99m689b4f812cc66nfi1ef42algb1jhlhkh3'

/**
 * The column each of 340 draws of `gaussian(0, 100)` fell into, in draw order.
 *
 * Same stream, same run and same binning as `UNIFORM`, taken after it.
 */
// note: seed 2026, drawn 2026-09-12; these are the 340 gaussian draws that followed the 340 uniform draws on the same stream
const GAUSSIAN =
  '98dmbf49gdbeflafg77bgb43cbeba9fcalgifbd2fabbg9db87f995ah77icd9be4gbiljihgdd79bafb2b4eee8ffa8ca8b8ied46g6f97cdihe9hdfdhf67decbf88ga9n957de8939j52fa76jf8a746cdafjfead69bbaeicb6gcjabidc7hgadbf8dhcccgbdajih7ceb8ce9efe3dca9e8be89ggdciddkbdbea9d5ldai6eid6cb69c898f4dcgbafc99bea43dbeh476befaegfad989i9b8f84b9dbda7df9fc7j5dabaf9bc8hg6aac70aejb0igdb'

/**
 * Read a run of base-24 digits back into column indices.
 *
 * @param encoded - One digit per draw, from `DIGITS`.
 * @returns The column of each draw, in draw order.
 */
function decodeColumns(encoded: string): readonly number[] {
  return encoded.split('').map((digit) => max(0, DIGITS.indexOf(digit)))
}

/**
 * Grains falling into place: the two shapes a seeded stream draws.
 *
 * `createRandomGenerator(2026)` opens one stream; `uniform(0, 100)` and
 * `gaussian(0, 100)` draw from it. A single draw looks like nothing, so the
 * frame shows hundreds: on each board a grain appears at the top, over the
 * column the next draw fell into, and drops onto the pile already there. For
 * the first second the piles are ragged and unpredictable. By the end the
 * uniform board has flattened into a plateau and the gaussian board has risen
 * into a bell, and the difference between the two methods is a picture.
 *
 * Every grain's column is the real generator's own draw, embedded above in
 * draw order, so the raggedness on the way and the shapes at the end are what
 * seed 2026 actually produces. Both boards release a grain every 22 ms from
 * 400 ms; the last of 340 lands at about 8.2 s and the frame rests on the two
 * finished shapes.
 */
export default defineScriptedScene({
  slug: 'random-generator-shapes',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: galtonStage,
  holdMs: 1_800,
  gif: { colours: 48, lossy: 60, maxBytes: 800_000 },
  stills: [{ name: 'poster', atMs: 8_400, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    api: { name: 'createRandomGenerator(2026)', mark: identity.mark },
    columns: COLUMNS,
    axis: ['0', '100'],
    startMs: 400,
    everyMs: 22,
    fallMs: 380,
    restMs: 1_300,
    boards: [
      { label: 'uniform(0, 100)', tone: 'accent', draws: decodeColumns(UNIFORM) },
      { label: 'gaussian(0, 100)', tone: 'success', draws: decodeColumns(GAUSSIAN) },
    ],
  },
})
