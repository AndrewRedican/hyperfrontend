# @hyperfrontend/random-generator-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-random-generator-utils.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-random-generator-utils.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=random-generator-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=random-generator-utils" alt="Coverage">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/random-generator-utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/random-generator-utils?style=flat-square" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/random-generator-utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/random-generator-utils?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
</p>

Statistical random distributions and UUID generation for simulations, testing, and procedural content.

## What is @hyperfrontend/random-generator-utils?

@hyperfrontend/random-generator-utils provides random number generators beyond JavaScript's basic `Math.random()`, focusing on statistical distributions used in simulations, load testing, and procedural generation. It includes Gaussian (normal), exponential, power law, and logarithmic distributions, plus UUID v4 generation and seeded pseudo-random functions.

Unlike cryptographic random generators (like Web Crypto API), these utilities prioritize reproducibility and distribution shapes over security. The seeded pseudo-random generator allows deterministic sequences for testing, while statistical distributions model real-world phenomena like response times, user behavior, and natural variation.

### Key Features

- **Statistical distributions**: Gaussian, exponential, power law, logarithmic, uniform
- **UUID v4 generation** with validation (`uuidV4()`, `isUuidV4()`)
- **Seeded pseudo-random** for reproducible sequences in tests
- **Time-based seeding** for pseudo-random variations
- **Zero dependencies** (except sibling @hyperfrontend/data-utils)
- **Pure functions** for functional composition

### Architecture Highlights

All generators use `Math.random()` as the entropy source, transformed mathematically to match target distributions. Gaussian uses Box-Muller transform, exponential uses inverse transform sampling. Seeded generator uses sine function for deterministic output.

## Why Use @hyperfrontend/random-generator-utils?

### Realistic Load Testing and Simulations

`Math.random()` generates uniform distributions, but real-world events follow different patterns. User response times cluster around an average (Gaussian), server failures often show exponential decay, and popularity follows power law distributions (80/20 rule). These generators let you model realistic scenarios in load tests and simulations.

### Reproducible Pseudo-Random Sequences for Testing

The seeded pseudo-random generator (`randomPseudo()`) produces deterministic output from a numeric seed. This enables reproducible test scenarios, snapshot testing with "random" data, and debugging flaky tests caused by true randomness. Time-based seeding (`randomPseudoTimeBased()`) provides daily or hourly variations while maintaining reproducibility within those windows.

### UUID Generation Without External Dependencies

Many projects pull in the `uuid` package (500KB+) just for v4 UUIDs. This library provides a lightweight alternative with both generation and validation. Ideal for test fixtures, trace IDs, or non-security-critical unique identifiers without bloating bundles.

### Functional Composition for Data Pipelines

All generators are pure functions accepting parameters and returning numbers. This makes them composable in data generation pipelines, Array methods (`Array.from({ length: 100 }, () => randomGaussian(0, 100))`), or streaming data generators for charts and visualizations.

## Installation

```bash
npm install @hyperfrontend/random-generator-utils
```

## Quick Start

```typescript
import {
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
const citySize = randomPowerLaw(2.5, 100, 1000000) // Zipf's law for cities

// Uniform distribution - flat probability across range
const randomDelay = randomUniform(0, 1000) // Any value 0-1000ms equally likely

// Seeded pseudo-random for reproducible tests
const seed = 42
const value1 = randomPseudo(seed) // Always same output for seed=42
const value2 = randomPseudo(seed) // Identical to value1

// UUID generation
const id = uuidV4() // "a3bb189e-8bf9-4558-9e3e-e7b9a9e7b8c1"
console.log(isUuidV4(id)) // true
console.log(isUuidV4('not-a-uuid')) // false
```

## API Overview

### Statistical Distributions

- **`randomUniform(min, max)`** - Uniform distribution (flat probability)
- **`randomGaussian(min, max)`** - Gaussian/normal distribution (bell curve)
- **`randomExponential(lambda)`** - Exponential distribution (decay)
- **`randomPowerLaw(alpha, min, max)`** - Power law distribution (long tail)
- **`randomLogarithmic(scale)`** - Logarithmic distribution

### Pseudo-Random Generators

- **`randomPseudo(seed)`** - Seeded pseudo-random (reproducible)
- **`randomPseudoTimeBased(seedTime)`** - Time-based seeding for date/time variations

### UUID Utilities

- **`uuidV4()`** - Generate RFC 4122 version 4 UUID
- **`isUuidV4(str)`** - Validate UUID v4 format

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
// Generate reproducible test datasets
const seed = Date.now()
const testData = Array.from({ length: 50 }, (_, i) => ({
  id: uuidV4(),
  score: randomPseudo(seed + i) * 100, // Reproducible but varied
  timestamp: new Date(Date.now() + randomUniform(0, 86400000)),
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

| Platform                      | Support |
| ----------------------------- | :-----: |
| Browser                       |   ✅    |
| Node.js                       |   ✅    |
| Web Workers                   |   ✅    |
| Deno, Bun, Cloudflare Workers |   ✅    |

### Output Formats

| Format | File                       | Tree-Shakeable |
| ------ | -------------------------- | :------------: |
| ESM    | `index.esm.js`             |       ✅       |
| CJS    | `index.cjs.js`             |       ❌       |
| IIFE   | `bundle/index.iife.min.js` |       ❌       |
| UMD    | `bundle/index.umd.min.js`  |       ❌       |

**Bundle size:** 1 KB (minified, self-contained)

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

**Global variable:** `HyperfrontendRandomGenerator`

### Dependencies

| Package                   | Type     |
| ------------------------- | -------- |
| @hyperfrontend/data-utils | Internal |

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

- Used by [@hyperfrontend/cryptography](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/cryptography) for secure random generation

## License

MIT
