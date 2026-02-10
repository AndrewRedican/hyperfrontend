---
title: Getting Started
weight: 1
---

## Overview

hyperfrontend is a hybrid micro-frontend pattern that enables building composable web applications. This guide will walk you through installation and creating your first feature.

First, ensure you have an [Nx workspace](https://nx.dev/getting-started/intro) set up.

Then add the hyperfrontend features plugin:

```bash
npx nx add @hyperfrontend/features
```

This will automatically install the `@hyperfrontend/nexus` library and configure your workspace.

### Creating a Feature

Initialize an existing application as a hyperfrontend feature:

```bash
npx nx g @hyperfrontend/features:init
```

The generator will prompt you for:

- Which project to target
- Where to store the feature configuration and contracts

### Consuming a Feature

Add a feature to a host application:

```bash
npx nx g @hyperfrontend/features:add
```

The generator will prompt you for:

- The feature name
- Which host project to add it to

The plugin generates typed bindings from the feature's contracts and vanilla JavaScript integration code.

### Testing Your Feature

Run the playground host to see how your feature loads:

```bash
npx nx serve <your-feature-name>
```

This launches a development environment where you can debug and interact with your feature in isolation.

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
