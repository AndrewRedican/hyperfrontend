# Workspace Discovery Auto-Detection

**Current State:** Default patterns are `libs/`, `apps/`, `packages/`, `tools/`, `plugins/`.

**Future Direction:** Auto-detect from workspace config files:

```typescript
// Sketch
function inferDiscoveryPatterns(workspaceRoot: string): string[] {
  // Check nx.json for project locations
  const nxJson = readNxJson(workspaceRoot)
  if (nxJson?.workspaceLayout) {
    return [`${nxJson.workspaceLayout.libsDir}/*`, `${nxJson.workspaceLayout.appsDir}/*`]
  }

  // Check pnpm-workspace.yaml
  const pnpmWorkspace = readPnpmWorkspace(workspaceRoot)
  if (pnpmWorkspace?.packages) {
    return pnpmWorkspace.packages
  }

  // Fall back to defaults
  return DEFAULT_PATTERNS
}
```

**Why Later:** Current configurable `patterns` option is sufficient workaround.
