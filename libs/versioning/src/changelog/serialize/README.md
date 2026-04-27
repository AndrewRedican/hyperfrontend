# serialize

Serializers that convert structured `Changelog` objects back to Keep-a-Changelog markdown or to JSON.

`serializeChangelog` produces a stable, deterministic markdown rendering driven by `SerializeOptions` (heading style, bullet markers, link references, spacing). Helpers (`getSectionHeading`, `formatLink`, `getListMarker`, `createSpacing`) expose the underlying templating primitives for downstream tools that want to format individual fragments. `serializeChangelogToJson` and `toJsonObject` produce a `JsonSerializeOptions`-controlled JSON shape suitable for archiving or for tools that prefer structured data over markdown.
