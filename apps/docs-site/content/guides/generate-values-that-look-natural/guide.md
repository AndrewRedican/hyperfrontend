# How to generate values that look natural instead of random

You will give sizes, speeds, offsets, and spawn timings a believable spread, so a screen full of generated things reads as a crowd rather than as output from a loop.

[`Math.random`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random) is uniform, and uniform is the one distribution nature almost never produces. Scatter fifty elements with it and every size is equally likely, which is why the result looks sorted rather than grown: too many extremes, no typical value for the eye to settle on. [`@hyperfrontend/random-generator-utils`](/docs/libraries/utils/random-generator) provides the shapes that do occur, bounded so they stay inside a layout.

## 1. Install it

```bash
npm install @hyperfrontend/random-generator-utils
```

## 2. Cluster values around a typical one

[`randomGaussian`](/docs/libraries/utils/random-generator#api-randomGaussian) takes the range you can live with and returns a bell curve inside it. The midpoint is the value you get most often, and the two ends are rare but reachable:

```js
import { randomGaussian } from '@hyperfrontend/random-generator-utils'

const size = randomGaussian(24, 96)
```

The range sets the spread as well as the limits: the curve is centred on the midpoint with a standard deviation of one sixth of the range, so about two thirds of the values land in the middle third of the band and the outer sixths are where the occasional outlier comes from. Pick the range by asking what the smallest and largest acceptable values are, and the shape follows.

Both ends are hard limits rather than tails that trail off, which is what makes this safe to feed straight into a layout without clamping afterwards.

## 3. Jitter around a value you already have

Most motion is not a fresh value but a small deviation from an intended one. Centre the range on zero and add it to what you had:

```js
const BASE_SPEED = 40

const speed = BASE_SPEED + randomGaussian(-12, 12)
```

Small deviations are common, large ones are rare, and nothing ever drifts more than 12 away. Reach for [`randomUniform`](/docs/libraries/utils/random-generator#api-randomUniform) where the opposite is true and every value really is equally likely, such as picking a starting angle or a position along a track.

## 4. Space events out instead of running a metronome

Things that arrive independently arrive in clumps, then leave gaps. [`randomExponential`](/docs/libraries/utils/random-generator#api-randomExponential) takes a rate and returns the wait until the next one, which is exactly the gap that produces that clumping:

```js
import { randomExponential } from '@hyperfrontend/random-generator-utils'

function scheduleNext(spawn, perSecond) {
  const gap = randomExponential(perSecond)
  setTimeout(() => {
    spawn()
    scheduleNext(spawn, perSecond)
  }, gap * 1000)
}
```

The rate is per unit of time and the average gap is its reciprocal, so `scheduleNext(spawn, 20)` averages twenty spawns a second while no two of them are evenly spaced. A [`setInterval`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval) at the same rate is visibly a machine; this is not.

## 5. Get the same arrangement back tomorrow

A generated layout you cannot reproduce is one you cannot debug or screenshot-test. [`randomPseudo`](/docs/libraries/utils/random-generator#api-randomPseudo) turns a number into a value between 0 and 1 and always returns the same one for the same number, so deriving a seed per item makes the whole arrangement a function of one input:

```js
import { randomPseudo } from '@hyperfrontend/random-generator-utils'

const STRIDE = 1000

function layout(seed, count, width) {
  const base = seed * STRIDE
  return Array.from({ length: count }, (_, index) => ({
    x: randomPseudo(base + index) * width,
    depth: randomPseudo(base + count + index),
  }))
}
```

Two values drawn from the same number are the same value, so every independent property needs its own stretch of the seed space: `base + index` for one, `base + count + index` for the next. The `STRIDE` multiplier is what keeps one seed's stretch clear of the next seed's, and it has to exceed the total number of draws per seed. Without it, seed 5 and seed 6 share all but one of their values and the "different" arrangement is the same one shifted along by a slot.

Give the seed a meaning from your own data, such as a record id or the day's date, and every visitor sees the same arrangement while it still differs between records.

## Check it worked

Generate a few hundred values with `randomGaussian(24, 96)` and bucket them into a rough histogram: the counts rise toward the middle and thin out at both ends, against the flat line the same count of `randomUniform` calls gives you. Check the extremes: no value is below 24 or above 96, however many you draw. Then run your spawner for a minute and count the arrivals, which land near the rate you asked for while the gaps between them visibly vary. Finally, render a seeded layout twice and compare: identical for the same seed. Then render the neighbouring seed and check that none of its values repeats one of the first layout's, which is the `STRIDE` doing its job.
