# Verdaccio Local Testing

**Date**: February 8, 2026

---

## Overview

Verdaccio provides a local npm registry for testing package publishing and integration before going to the public npm registry.

---

## Quick Start

### Start Verdaccio

```bash
# Verdaccio is already installed as a devDependency
npx verdaccio
```

Runs at: `http://localhost:4873`

### Publish to Local Registry

```bash
# Build and publish a library locally
npx nx build lib-data-utils
npx nx publish lib-data-utils --registry=http://localhost:4873

# Or dry-run first
npx nx publish lib-data-utils --registry=http://localhost:4873 --dryRun
```

---

## Integration Testing Workflow

### 1. Publish All Libraries Locally

```bash
# Build all libraries
npx nx run-many -t=build --all

# Publish all libraries to Verdaccio
npx nx run-many -t=publish --all --registry=http://localhost:4873
```

### 2. Create Test Project

```bash
# In a separate directory
mkdir /tmp/hyperfrontend-test
cd /tmp/hyperfrontend-test
npm init -y

# Configure to use local registry
npm config set registry http://localhost:4873 --location project

# Install libraries from Verdaccio
npm install @hyperfrontend/nexus
npm install @hyperfrontend/cryptography
```

### 3. Test Imports

Create a test file (`test.mjs`):

```javascript
// ESM import test
import { createBroker, createChannel } from '@hyperfrontend/nexus'
import { encrypt, decrypt } from '@hyperfrontend/cryptography/node'

console.log('ESM imports work:', typeof createBroker, typeof encrypt)

// Test basic functionality
const broker = createBroker()
console.log('Broker created:', broker !== undefined)
```

Run:

```bash
node test.mjs
```

### 4. Test CJS Imports

Create a test file (`test.cjs`):

```javascript
// CJS require test
const { createBroker, createChannel } = require('@hyperfrontend/nexus')
const { encrypt, decrypt } = require('@hyperfrontend/cryptography/node')

console.log('CJS imports work:', typeof createBroker, typeof encrypt)
```

Run:

```bash
node test.cjs
```

---

## Automated Integration Tests (Future)

A future enhancement could add automated integration testing:

```yaml
# .github/workflows/integration-test.yml
name: integration-test

on:
  workflow_dispatch:
  pull_request:
    paths:
      - 'libs/**'

jobs:
  test-integration:
    runs-on: ubuntu-latest
    services:
      verdaccio:
        image: verdaccio/verdaccio
        ports:
          - 4873:4873
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-monorepo

      - name: Build all libraries
        run: npx nx run-many -t=build --all

      - name: Publish to Verdaccio
        run: npx nx run-many -t=publish --all --registry=http://localhost:4873

      - name: Create test project
        run: |
          mkdir /tmp/test-project
          cd /tmp/test-project
          npm init -y
          npm config set registry http://localhost:4873 --location project
          npm install @hyperfrontend/nexus @hyperfrontend/cryptography

      - name: Run integration tests
        run: |
          cd /tmp/test-project
          node -e "
            import('@hyperfrontend/nexus').then(m => {
              console.log('nexus loaded:', Object.keys(m).length, 'exports')
            })
          "
```

---

## Verdaccio Configuration

Default config location: `~/.config/verdaccio/config.yaml`

### Disable Authentication for Local Testing

```yaml
# In config.yaml
auth:
  htpasswd:
    file: ./htpasswd
packages:
  '@hyperfrontend/*':
    access: $all
    publish: $all
    unpublish: $all
```

### Clear Verdaccio Cache

```bash
rm -rf ~/.local/share/verdaccio/storage/@hyperfrontend
```

---

## Notes

- Verdaccio stores packages in `~/.local/share/verdaccio/storage/`
- By default, Verdaccio proxies to npm for packages it doesn't have
- Use `--registry` flag consistently to ensure you're using local registry
- Verdaccio web UI available at `http://localhost:4873`

---

## Related Documents

- [DEPLOYMENT_PUBLISHING.md](./DEPLOYMENT_PUBLISHING.md) — Publishing workflow
- [build-and-deployment-plan.md](./build-and-deployment-plan.md) — CI/CD overview
