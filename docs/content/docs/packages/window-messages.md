---
title: "@hyperfrontend/window-messages"
---

Window messaging utilities for cross-frame communication.

## Overview

The `@hyperfrontend/window-messages` package provides:
- Standardized communication protocol
- Type-safe message contracts
- Pub/sub event bus
- Runtime isolation between features

## Installation

```bash
npm install @hyperfrontend/window-messages
```

## Usage

```typescript
import { WindowMessageBroker } from '@hyperfrontend/window-messages';

const broker = new WindowMessageBroker();

// Subscribe to messages
broker.on('message-type', (data) => {
  console.log('Received:', data);
});

// Publish messages
broker.send('message-type', { payload: 'data' });
```

## Learn More

- [GitHub Repository](https://github.com/AndrewRedican/hyperfrontend/tree/main/packages/window-messages)
- [Full Documentation](https://github.com/AndrewRedican/hyperfrontend/blob/main/packages/window-messages/README.md)
