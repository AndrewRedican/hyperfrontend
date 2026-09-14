# @hyperfrontend/random-generator-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-random-generator-utils.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-random-generator-utils.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=random-generator-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=random-generator-utils" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/random-generator-utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/random-generator-utils?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/random-generator-utils">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Frandom-generator-utils?style=flat-square" alt="npm bundle size">
  </a>
</p>
<p align="center">
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/random-generator-utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/random-generator-utils?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/random-generator-shapes/hero.gif" alt="Two boards side by side under a createRandomGenerator(2026) chip; grains fall one at a time from the top into columns, and as hundreds land the uniform board settles into a flat plateau while the gaussian board rises into a bell">
  </a>
</p>

Statistical random distributions and UUID generation for simulations, testing, and procedural content.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Frandom-generator-utils)

## What is @hyperfrontend/random-generator-utils?

@hyperfrontend/random-generator-utils provides random number generators beyond JavaScript's basic `Math.random()`, focusing on statistical distributions used in simulations, load testing, and procedural generation. It includes Gaussian (normal), exponential, power law, and logarithmic distributions, plus UUID v4 generation and a seeded generator that replays every one of them from a single number.

Unlike cryptographic random generators (like Web Crypto API), these utilities prioritize reproducibility and distribution shapes over security. `createRandomGenerator(seed)` turns one number into a deterministic stream of every distribution for tests and procedural scenes, while the same distributions model real-world phenomena like response times, user behavior, and natural variation.

### Key Features

- **[Statistical distributions](https://www.hyperfrontend.dev/docs/guides/generate-values-that-look-natural/)**: Gaussian, exponential, power law, logarithmic, uniform
- **[Seeded streams](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-createRandomGenerator)**: `createRandomGenerator(seed)` replays every distribution and UUID from one seed
- **[Pluggable source](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-RandomSource)**: every distribution accepts a `() => number` source, so any generator can drive it
- **[UUID v4 generation](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-uuidV4)** with validation (`uuidV4()`, `isUuidV4()`)
- **[Stateless seeded hash](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-randomPseudo)** (`randomPseudo()`) for one-off reproducible values
- **[Time-based seeding](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-randomPseudoTimeBased)** for pseudo-random variations
- **No third-party dependencies**: at runtime it imports only JavaScript built-ins and `@hyperfrontend` utilities
- **Pure functions** for functional composition

### Architecture Highlights

Every distribution is a mathematical transform over a unit draw. The draw comes from a source that defaults to `Math.random()` and can be any `() => number`; [`createRandomGenerator`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-createRandomGenerator) supplies a mulberry32 stream, a 32-bit generator with a period of 2^32 draws. Gaussian uses the polar form of the Box-Muller transform, exponential uses inverse transform sampling, and [`randomPseudo`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-randomPseudo) is a stateless sine hash.

## Why Use @hyperfrontend/random-generator-utils?

### Realistic Load Testing and Simulations

`Math.random()` generates uniform distributions, but real-world events follow different patterns. User response times cluster around an average (Gaussian), server failures often show exponential decay, and popularity follows power law distributions (80/20 rule). These generators let you model realistic scenarios in load tests and simulations.

### Reproducible Pseudo-Random Sequences for Testing

`createRandomGenerator(seed)` returns a stream whose every method ([`uniform`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-RandomGenerator), [`gaussian`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-RandomGenerator), [`exponential`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-RandomGenerator), [`powerLaw`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-RandomGenerator), [`logarithmic`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-RandomGenerator), [`uuidV4`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-uuidV4)) replays exactly for the same seed. Log the seed when a property test fails and pass it back in to reproduce the input, or derive it from a record id so every visitor sees the same procedural scene. For a single reproducible value with no stream to carry, `randomPseudo(seed)` hashes a number straight to a result, and `randomPseudoTimeBased()` does the same for a date, which gives daily or hourly variations that stay stable within their window.

### UUID Generation Without External Dependencies

Many projects pull in the [`uuid`](https://www.npmjs.com/package/uuid) package (500KB+) just for v4 UUIDs. This library provides a lightweight alternative with both generation and validation. Ideal for test fixtures, trace IDs, or non-security-critical unique identifiers without bloating bundles.

### Functional Composition for Data Pipelines

All generators are pure functions accepting parameters and returning numbers. This makes them composable in data generation pipelines, Array methods (`Array.from({ length: 100 }, () => randomGaussian(0, 100))`), or streaming data generators for charts and visualizations.

## Installation

```bash
npm install @hyperfrontend/random-generator-utils
```

## Quick Start

```typescript
import {
  createRandomGenerator,
  randomGaussian,
  randomExponential,
  randomPowerLaw,
  randomUniform,
  randomPseudo,
  uuidV4,
  isUuidV4,
} from '@hyperfrontend/random-generator-utils'

// Gaussian (normal) distribution - ideal for modeling natural variation
const responseTime = randomGaussian(100, 300) // ms, centered around 200ms
const userHeight = randomGaussian(160, 180) // cm, most values near 170cm

// Exponential distribution - models time between independent events
const timeBetweenRequests = randomExponential(0.5) // λ=0.5, mean=2 seconds
const failureRate = randomExponential(0.1) // λ=0.1, mean=10 units

// Power law distribution - models "rich get richer" phenomena
const popularity = randomPowerLaw(2, 1, 1000) // Few items very popular
const citySize = randomPowerLaw(1.1, 100, 1000000) // Zipf's law for cities

// Uniform distribution - flat probability across range
const randomDelay = randomUniform(0, 1000) // Any value 0-1000ms equally likely

// Seeded stream - every distribution replays from one number
const stream = createRandomGenerator(2026)
const size = stream.gaussian(24, 96) // Same value on every run that seeds 2026
const gap = stream.exponential(0.5) // ...and the next draw, and the next
const fixtureId = stream.uuidV4() // Stable ids for snapshot fixtures

// Any distribution can draw from the stream directly
const angle = randomUniform(0, 360, stream.next)

// Stateless seeded hash for a one-off reproducible value
const seed = 42
const value1 = randomPseudo(seed) // Always same output for seed=42
const value2 = randomPseudo(seed) // Identical to value1

// UUID generation
const id = uuidV4() // "a3bb189e-8bf9-4558-9e3e-e7b9a9e7b8c1"
console.log(isUuidV4(id)) // true
console.log(isUuidV4('not-a-uuid')) // false
```

## API Overview

Five distributions, one call shape: parameters that describe the shape go in, a single number comes out.
[`randomGaussian(min, max)`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-randomGaussian) clusters draws around the midpoint of a
bounded range and never leaves it, [`randomExponential(lambda)`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-randomExponential)
decays with a mean of `1 / lambda`, and [`randomPowerLaw(alpha, min, max)`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-randomPowerLaw)
piles most of its mass near [`min`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-randomPowerLaw) while keeping a long tail out to [`max`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-randomPowerLaw); [`randomLogarithmic`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-randomLogarithmic) and [`randomUniform`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-randomUniform) cover the skewed and the flat cases. Every one
of them ends with an optional `source: () => number` that defaults to `Math.random`, and that last parameter is the seam the rest of the package plugs into.

[`createRandomGenerator(seed)`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-createRandomGenerator) fills the seam. It returns a
frozen object carrying the [`seed`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-RandomGenerator-prop-seed) it was opened with, a `next()` that draws the stream's unit values, and one method per distribution, so a whole procedural
scene or fixture set becomes a function of one number and replays draw for draw on any machine. The methods share a single stream, which means the order of the
calls is part of what the seed reproduces. [`next`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-RandomGenerator-prop-next) is a plain function and detaches cleanly, so `randomUniform(0, 360, stream.next)` puts a free-standing
distribution on the same stream.

Two smaller pieces sit outside the stream. [`randomPseudo(seed)`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-randomPseudo) is a
stateless hash rather than a generator: one seed maps to one value forever, which is what you want for a single reproducible number and not what you want for a
sequence ([`randomPseudoTimeBased`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-randomPseudoTimeBased) is the same hash over a `Date`, which is how you get a variation that holds steady for a day or an hour). And
[`uuidV4()`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-uuidV4) generates a version 4 id, drawing from a seeded source when you
hand it one, with [`isUuidV4`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-isUuidV4) to check a string coming back the other way.

Every parameter, bound and return type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/#api-reference).

## Use Cases

### Load Testing

```typescript
// Model realistic user behavior with varying response times
const users = Array.from({ length: 1000 }, () => ({
  thinkTime: randomExponential(0.5), // Time between actions
  responseTime: randomGaussian(50, 200), // Server response latency
  requestCount: Math.floor(randomPowerLaw(2, 1, 100)), // Request frequency
}))
```

### Test Data Generation

```typescript
// Generate reproducible test datasets: log stream.seed, replay the run
const stream = createRandomGenerator(Date.now())
const testData = Array.from({ length: 50 }, () => ({
  id: stream.uuidV4(),
  score: stream.gaussian(0, 100),
  timestamp: new Date(Date.now() + stream.uniform(0, 86400000)),
}))
```

### Procedural Content

```typescript
// Generate varied but natural-looking values
const terrain = {
  height: randomGaussian(0, 100), // Centered around 50
  vegetation: randomUniform(0, 1), // Uniform coverage
  populationDensity: randomPowerLaw(2, 1, 1000), // Power law distribution
}
```

## Compatibility

<!-- hf:media start id="runtimes" scene="runtimes-random-generator-utils" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 18 or later, evergreen browsers and web workers" -->

| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 18   |    ✅     |
| Modern Browsers |    ✅     |
| Web Workers     |    ✅     |

<!-- hf:media end -->

### Output Formats

| Format | File                       | Tree-Shakeable |
| ------ | -------------------------- | :------------: |
| ESM    | `index.esm.js`             |       ✅       |
| CJS    | `index.cjs.js`             |       ❌       |
| IIFE   | `bundle/index.iife.min.js` |       ❌       |
| UMD    | `bundle/index.umd.min.js`  |       ❌       |

### CDN Usage

```html
<!-- unpkg -->
<script src="https://unpkg.com/@hyperfrontend/random-generator-utils"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/random-generator-utils"></script>

<script>
  const { randomGaussian, randomUniform, uuid4 } = HyperfrontendRandomGenerator
</script>
```

**Global variable:** [`HyperfrontendRandomGenerator`](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/)

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator)**

- Used by [@hyperfrontend/cryptography](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/cryptography) for secure random generation

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
