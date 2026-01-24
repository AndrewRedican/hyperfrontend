---
title: Live Demos
weight: 3
---

## Interactive Demonstrations

Explore these live demos to see hyperfrontend in action. Each demo showcases different aspects of the micro-frontend architecture.

| Demo                                                    | Description                |
| ------------------------------------------------------- | -------------------------- |
| [Chess](https://hyperfrontend.dev/demo/chess)           | Chess game demonstration   |
| [Clock](https://hyperfrontend.dev/demo/clock)           | Clock demonstration        |
| [Events](https://hyperfrontend.dev/demo/events)         | Events demonstration       |
| [File Share](https://hyperfrontend.dev/demo/file-share) | File sharing demonstration |
| [Heartbeat](https://hyperfrontend.dev/demo/heartbeat)   | Heartbeat demonstration    |
| [Views](https://hyperfrontend.dev/demo/views)           | Views demonstration        |

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

```bash
# Navigate to a demo directory
cd apps/demos/chess

# Install dependencies
npm install

# Start the demo
npm run dev
```

## Source Code

All demo source code is available in the [GitHub repository](https://github.com/AndrewRedican/hyperfrontend/tree/main/apps/demos).
