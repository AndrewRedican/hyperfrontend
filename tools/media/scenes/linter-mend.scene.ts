import { mendStage } from '../src/mend/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('linter')

/**
 * A file read, marked and mended, with nothing installed beneath the package.
 *
 * The claim the package makes is that it reads a file with a parser of its
 * own, runs the rules a configuration turns on over what it read, and
 * writes the fixes back. So the frame is one file on a sheet, read by a
 * beam line by line; the shape the parser makes of it grows beside it, one
 * node per statement at the height of its line, nested the way the code
 * nests; a rule that finds something underlines the span it reports and
 * lands its id beside the node it listens on; then the fix flag lights on
 * the command chip and the fixes land one by one, the span rewritten in
 * place, the node's label following, the tag getting its check. The check
 * beside the file's name is the clean run after.
 *
 * The listing and its three findings are the scene's own, chosen so that
 * every rule shown is one the package ships and every fix shown is one it
 * applies. All three were verified on 2026-10-23 by linting the listing
 * with `no-var`, `prefer-const` and `no-extra-boolean-cast` turned on
 * through `tools/lint/bin/lint.ts`: the report named those three rules at
 * lines 3, 4 and 6 and nothing else, and `--fix-dry-run` returned the
 * listing with `let total`, `const count` and `if (item.price)` written in,
 * which is the text the fixes write here. `hf-lint` and `--fix` are the
 * package's command and flag, from `libs/linter/package.json` and
 * `libs/linter/src/cli/args.ts`.
 */
export default defineScriptedScene({
  slug: 'linter-mend',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: mendStage,
  holdMs: 1_800,
  gif: { colours: 56, lossy: 45, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 8_600, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    mark: identity.mark,
    file: 'cart.ts',
    command: 'hf-lint',
    fixFlag: '--fix',
    lines: [
      "import { items } from './items'",
      '',
      'var total = 0',
      'let count = items.length',
      'for (const item of items) {',
      '  if (!!item.price) total += item.price',
      '}',
      'export { total, count }',
    ],
    findings: [
      { line: 2, from: 0, to: 3, rule: 'no-var', text: 'let' },
      { line: 3, from: 0, to: 3, rule: 'prefer-const', text: 'const' },
      { line: 5, from: 6, to: 18, rule: 'no-extra-boolean-cast', text: 'item.price' },
    ],
    readLineMs: 440,
    restMs: 1_200,
  },
})
