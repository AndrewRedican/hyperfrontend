# Changelog Section Type Extensions

**Current State:** Fixed `ChangelogSectionType` union with 12 types.

**Future Direction:** Allow registering custom section types:

```typescript
// Sketch - plugin-style registration
registerSectionType({
  name: 'security',
  displayHeading: '🔒 Security',
  commitTypes: ['security', 'vuln'],
})
```

**Why Later:**

- Current `'other'` fallback is acceptable
- Users can post-process changelog
- Plugin system adds complexity
