#!/usr/bin/env node

/**
 * README Content Extractor for Hugo Documentation
 *
 * This script programmatically extracts content from README.md and transforms it
 * into Hugo-compatible markdown files with proper frontmatter and structure.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  rootDir: path.resolve(__dirname, '../..'),
  docsDir: path.resolve(__dirname, '..'),
  contentDir: path.resolve(__dirname, '../content'),
  readmePath: path.resolve(__dirname, '../../README.md'),
  outputFiles: {
    home: path.resolve(__dirname, '../content/_index.md'),
    gettingStarted: path.resolve(__dirname, '../content/docs/getting-started.md'),
    concepts: path.resolve(__dirname, '../content/docs/concepts.md'),
    packages: path.resolve(__dirname, '../content/docs/packages.md'),
  }
};

/**
 * Parse README.md and extract structured sections
 */
function parseReadme() {
  const content = fs.readFileSync(CONFIG.readmePath, 'utf-8');
  const sections = {};

  // Extract sections based on headings
  const headingRegex = /^##\s+(.+)$/gm;
  let match;
  let lastHeading = null;
  let lastIndex = 0;

  while ((match = headingRegex.exec(content)) !== null) {
    if (lastHeading) {
      sections[lastHeading] = content.substring(lastIndex, match.index).trim();
    }
    lastHeading = match[1];
    lastIndex = match.index + match[0].length;
  }

  // Capture the last section
  if (lastHeading) {
    sections[lastHeading] = content.substring(lastIndex).trim();
  }

  // Extract intro (everything before first ##)
  const firstHeadingMatch = content.match(/^##\s+/m);
  const intro = firstHeadingMatch
    ? content.substring(0, firstHeadingMatch.index).trim()
    : '';

  return { intro, sections };
}

/**
 * Generate home page content
 */
function generateHomePage(readmeData) {
  const { intro, sections } = readmeData;

  // Extract key features from "What are hyperfrontend features?" section
  const featuresSection = sections['What are hyperfrontend features?'] || '';

  return `---
title: hyperfrontend
layout: hextra-home
---

<div class="hx-mt-6"></div>

{{< hextra/hero-headline >}}
  Build Composable Frontend Applications
{{< /hextra/hero-headline >}}

<div class="hx-mb-6"></div>

{{< hextra/hero-subtitle >}}
  A hybrid micro-frontend pattern to embed live web applications with communication protocols, lifecycle, and contract standards. Framework-agnostic, independently deployable, and runtime-isolated.
{{< /hextra/hero-subtitle >}}

<div class="hx-mb-12"></div>

{{< hextra/hero-button text="Get Started" link="/docs/getting-started" >}}
{{< hextra/hero-button text="View on GitHub" link="https://github.com/AndrewRedican/hyperfrontend" >}}

<div class="hx-mt-12"></div>

{{< hextra/feature-grid >}}
  {{< hextra/feature-card
    title="Framework Agnostic"
    subtitle="Use React, Vue, Angular, Svelte, or vanilla JavaScript. Mix different frameworks in the same application."
  >}}
  {{< hextra/feature-card
    title="Independent Deployment"
    subtitle="Each feature is independently deployable. No more waiting for other teams to merge, test, or deploy."
  >}}
  {{< hextra/feature-card
    title="Runtime Isolation"
    subtitle="Eliminate dependency conflicts. Each feature manages its own dependencies and upgrade schedule."
  >}}
  {{< hextra/feature-card
    title="Modernize Incrementally"
    subtitle="Wrap legacy applications as features. Replace components one at a time without expensive rewrites."
  >}}
  {{< hextra/feature-card
    title="Type-Safe Contracts"
    subtitle="Full TypeScript support with standardized communication protocols and clear API boundaries."
  >}}
  {{< hextra/feature-card
    title="Developer Friendly"
    subtitle="Works with modern build tools, SSR, static site generation, and includes an Nx plugin."
  >}}
{{< /hextra/feature-grid >}}
`;
}

/**
 * Generate getting started page
 */
function generateGettingStarted(readmeData) {
  const { sections } = readmeData;

  const installation = sections['Installation'] || '';
  const quickStart = sections['Quick Start'] || '';

  return `---
title: Getting Started
weight: 1
---

## Overview

hyperfrontend is a hybrid micro-frontend pattern that enables building composable web applications. This guide will walk you through installation and creating your first feature.

${installation}

${quickStart}

## What You'll Learn

- How to initialize a project as a hyperfrontend feature
- How to consume features in host applications
- How to test and debug your features

{{< callout type="info" >}}
  **Prerequisites**: Ensure you have Node.js 18+ and an [Nx workspace](https://nx.dev/getting-started/intro) set up.
{{< /callout >}}

## Next Steps

{{< cards >}}
  {{< card link="../concepts" title="Core Concepts" >}}
  {{< card link="../demos" title="Live Demos" >}}
  {{< card link="../packages" title="Packages" >}}
{{< /cards >}}
`;
}

/**
 * Generate concepts page
 */
function generateConcepts(readmeData) {
  const { sections } = readmeData;

  const features = sections['What are hyperfrontend features?'] || '';
  const why = sections['Why Hyperfrontend?'] || '';
  const capabilities = sections['Key Capabilities'] || '';

  return `---
title: Core Concepts
weight: 2
---

${features}

## Benefits

${why}

## Capabilities

${capabilities}

## Architecture Diagram

\`\`\`mermaid
graph TD
    A[Host Application] -->|Embeds| B[Feature 1: React]
    A -->|Embeds| C[Feature 2: Vue]
    A -->|Embeds| D[Feature 3: Angular]
    B -.->|window.postMessage| E[Communication Protocol]
    C -.->|window.postMessage| E
    D -.->|window.postMessage| E
    E -->|Events| F[Pub/Sub Event Bus]
\`\`\`

{{< callout type="info" >}}
  Each feature is completely isolated with its own dependencies, state, and lifecycle.
{{< /callout >}}

## How It Works

1. **Features** are standalone applications with clear interfaces
2. **Shell applications** load and initialize features at runtime
3. **Communication protocol** enables secure cross-frame messaging
4. **Event bus** provides decoupled pub/sub architecture
5. **Lifecycle hooks** manage mount, unmount, and update operations

## Use Cases

### Multi-Team Organizations

Perfect for organizations where:
- Teams work across different timezones
- Each team has independent priorities and roadmaps
- Different technical capabilities and framework preferences exist

### Legacy Modernization

Ideal for:
- Wrapping legacy applications without rewrites
- Incrementally replacing old components
- Running legacy and modern code side-by-side

### Micro-Frontend Architecture

Enables:
- Independent feature development and deployment
- Version isolation and independent upgrade cycles
- Mix-and-match framework strategies
`;
}

/**
 * Generate packages page
 */
function generatePackages(readmeData) {
  const { sections } = readmeData;

  const mainPackages = sections['Main Packages'] || '';
  const internalPackages = sections['Internal Packages'] || '';

  return `---
title: Packages
weight: 4
---

## Main Packages

${mainPackages}

## Internal Packages

${internalPackages}

## Package Categories

### Core Framework
- **@hyperfrontend/features** - Nx plugin for creating and managing features
- **@hyperfrontend/window-messages** - Communication protocol foundation

### Utilities
- **cryptography** - Browser and Node.js cryptography utilities
- **data-utils** - Data manipulation and transformation
- **function-utils** - Function composition and utilities
- **list-utils** - Array and list manipulation
- **string-utils** - String manipulation utilities
- **time-utils** - Time and date utilities

### Infrastructure
- **logging** - Structured logging framework
- **network-protocol** - Network layer with routing and security
- **state-machine** - State management with lifecycle hooks
- **web-worker** - Web Worker abstractions

### UI
- **ui-utils** - DOM manipulation, events, and mobile interactions
`;
}

/**
 * Generate demos page
 */
function generateDemos(readmeData) {
  const { sections } = readmeData;

  const demosTable = sections['Live Demos'] || '';

  return `---
title: Live Demos
weight: 3
---

## Interactive Demonstrations

Explore these live demos to see hyperfrontend in action. Each demo showcases different aspects of the micro-frontend architecture.

${demosTable}

{{< callout type="warning" >}}
  **Note**: Demo links will be updated once the demos are deployed. Currently showing placeholder URLs.
{{< /callout >}}

## What Each Demo Teaches

### Chess Demo
- Real-time state synchronization across frames
- Complex application logic in embedded context
- Two-way communication patterns

### Clock Demo
- Basic embedding and lifecycle management
- Time synchronization between host and feature
- Simple event handling

### Events Demo
- Custom event publishing and subscription
- Event-driven architecture patterns
- Decoupled communication

### File Share Demo
- Binary data transfer between frames
- Security policies and CORS handling
- File upload/download workflows

### Heartbeat Demo
- Connection health monitoring
- Automatic reconnection logic
- Status reporting

### Views Demo
- Multiple view management
- State persistence across view changes
- Dynamic feature loading and unloading

## Running Demos Locally

\`\`\`bash
# Navigate to a demo directory
cd apps/demos/chess

# Install dependencies
npm install

# Start the demo
npm run dev
\`\`\`

## Source Code

All demo source code is available in the [GitHub repository](https://github.com/AndrewRedican/hyperfrontend/tree/main/apps/demos).
`;
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Starting README extraction...\n');

  // Parse README
  console.log('📖 Parsing README.md...');
  const readmeData = parseReadme();
  console.log(`✓ Extracted ${Object.keys(readmeData.sections).length} sections\n`);

  // Ensure directories exist
  ensureDir(CONFIG.contentDir);
  ensureDir(path.join(CONFIG.contentDir, 'docs'));

  // Generate and write files
  const files = [
    { name: 'Home Page', path: CONFIG.outputFiles.home, generator: generateHomePage },
    { name: 'Getting Started', path: CONFIG.outputFiles.gettingStarted, generator: generateGettingStarted },
    { name: 'Concepts', path: CONFIG.outputFiles.concepts, generator: generateConcepts },
    { name: 'Packages', path: CONFIG.outputFiles.packages, generator: generatePackages },
  ];

  // Add demos page
  files.push({
    name: 'Demos',
    path: path.join(CONFIG.contentDir, 'docs/demos.md'),
    generator: generateDemos
  });

  console.log('📝 Generating documentation files...\n');

  files.forEach(({ name, path: filePath, generator }) => {
    const content = generator(readmeData);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✓ ${name} → ${path.relative(CONFIG.rootDir, filePath)}`);
  });

  console.log('\n✨ README extraction complete!\n');
  console.log('📁 Generated files:');
  files.forEach(({ path: filePath }) => {
    console.log(`  - ${path.relative(CONFIG.rootDir, filePath)}`);
  });

  console.log('\n💡 Next steps:');
  console.log('  1. Review generated files');
  console.log('  2. Run: npm run docs:dev');
  console.log('  3. Visit: http://localhost:1313\n');
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { parseReadme, generateHomePage, generateGettingStarted, generateConcepts };
