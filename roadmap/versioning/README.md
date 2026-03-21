# Versioning Library - Future Considerations

> Lower-priority improvements for later consideration.
> These are "nice to have" items that don't block current adoption.

## Improvements

- [Registry Abstraction Layer](./registry-abstraction-layer.md)
- [HTTP-Based npm Client](./http-based-npm-client.md)
- [Workspace Discovery Auto-Detection](./workspace-discovery-auto-detection.md)
- [Platform URL Formatter Extensions](./platform-url-formatter-extensions.md)
- [Changelog Section Type Extensions](./changelog-section-type-extensions.md)
- [Changelog Template Customization](./changelog-template-customization.md)
- [Breaking Change Indicator Customization](./breaking-change-indicator-customization.md)
- [MAX_INPUT_LENGTH Config](./max-input-length-config.md)
- [MAX_MESSAGE_LENGTH Config](./max-message-length-config.md)
- [MAX_VERSION_LENGTH Config](./max-version-length-config.md)
- [GPG Signature Support](./gpg-signature-support.md)
- [Custom Git Log Format](./custom-git-log-format.md)

## Declined

See [declined.md](./declined.md) for items that have been explicitly ruled out.

---

## Guiding Principle

Only add configurability when:

1. There's concrete external demand (not hypothetical)
2. The default genuinely blocks adoption (not just different preference)
3. The implementation maintains composability (not special-casing)
