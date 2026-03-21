# Changelog Template Customization

**Current State:** `createEmptyChangelog()` returns hardcoded template.

**Future Direction:** Accept template in factory:

```typescript
createEmptyChangelog({
  header: {
    title: '# Release Notes',
    description: ['Custom description...'],
  },
})
```

**Why Later:** Users can modify changelog after creation; low friction.
