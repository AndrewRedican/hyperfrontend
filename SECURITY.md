# Security Policy

## The Security Model

Before reporting or reviewing, read the model this project is built on:
**[Security Model](https://www.hyperfrontend.dev/docs/core-concepts/security)**. It is the canonical
statement of what hyperfrontend defends against and what it does not, and it is the reference every
other security claim in these docs points back to. In short:

- **The named adversary is co-resident script**: an analytics snippet, tag manager, compromised
  dependency, or unknown page that embeds a feature URL. A host that deliberately installs a feature
  is trusting it, the way it trusts any dependency; the controls exist to bound a trusted
  feature's bad day, not to treat its authors as hostile.
- **Origin checks authenticate rooms, not speakers.** Once arbitrary script runs inside a page, no
  message check distinguishes it from the application. Threats inside a page need Content Security
  Policy, Trusted Types, dependency provenance, and server-side authorisation. That is a different
  treatment, deliberately outside this model.
- **Three parties carry the security of an integration.** The browser enforces document isolation
  and the frame's capability attributes; the protocol enforces the relationship (pinned
  counterparts, gated handshake, validated payloads, versioned contracts, an optional encrypted
  envelope); and **you** decide authorisation: `frame-ancestors`, backend checks, HTTPS, the
  envelope you choose, and the containment posture you set.

A vulnerability report is most useful when it names which of those three the issue defeats.

## Reporting a Vulnerability

We take the security of hyperfrontend seriously. If you discover a security vulnerability, please help us protect our users by following responsible disclosure practices.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities directly via email to:

**<andrew.redican.mejia@gmail.com>**

### What to Include

To help us understand and resolve the issue quickly, please include the following information in your report:

- **Description**: A clear description of the vulnerability
- **Impact**: The potential impact and severity of the issue
- **Reproduction Steps**: Detailed steps to reproduce the vulnerability
- **Environment**: The version of hyperfrontend affected, browser/Node.js version, operating system, etc.
- **Proof of Concept**: If possible, include a minimal code example or proof of concept
- **Suggested Fix**: If you have ideas on how to fix the issue (optional)

### Response Timeline

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 2 business days
- **Initial Assessment**: We will provide an initial assessment within 5 business days
- **Patch Development**: We aim to develop and test a patch within 10 days of acknowledgment
- **Public Disclosure**: Please allow at least **10 days** from the initial report before making the vulnerability publicly known

This grace period gives us time to:

- Verify and reproduce the issue
- Develop and test a fix
- Release a patched version
- Notify users to update their dependencies

### Coordinated Disclosure

We believe in coordinated disclosure and appreciate your cooperation in:

- Not exploiting the vulnerability beyond what is necessary to demonstrate it
- Not accessing, modifying, or deleting data that doesn't belong to you
- Allowing us reasonable time to address the issue before public disclosure
- Making a good faith effort to avoid privacy violations, data destruction, and service interruption

### Recognition

Once the vulnerability is patched and publicly disclosed, we will acknowledge your responsible disclosure in:

- Our release notes
- Our security advisories (if applicable)
- This SECURITY.md file (with your permission)

Thank you for helping keep hyperfrontend and its users safe!

## Security Best Practices

These are the decisions the SDK cannot make for you. Everything the protocol already enforces —
origin pinning, window binding, instance identity, the gated handshake, payload validation on both
ends — is on by default and is not something you should be re-implementing by hand.

1. **Restrict who may embed the feature.** Send
   `Content-Security-Policy: frame-ancestors <hosts>` on the response that serves the feature
   document. Origin pinning keeps a conversation consistent; only `frame-ancestors` decides whether
   a page was ever allowed to frame you.
2. **Authorise on the server.** A message that crossed the boundary is not an authorised operation.
   Protected work needs credentials the feature's own backend validates.
3. **Choose the envelope deliberately.** `v2` with a pre-shared key is the confidentiality control;
   `v1` is time-window obfuscation and buys deterrence only. Provision and rotate the `v2` key
   yourself; a key is never baked into a built artifact. A handshake that cannot agree on an
   encrypted transport falls back to plaintext; where that would be unacceptable, drive
   `@hyperfrontend/nexus` directly and set `security.mode: 'fail-closed'` on the channel so the
   connection is denied instead.
4. **Declare schemas and a contract version.** Actions without a schema pass unvalidated, and a side
   without a version always passes the compatibility gate. Both are how drift is caught early.
5. **Grant capability narrowly.** Delegate only the Permissions-Policy features the integration
   needs, and price a `sandbox` posture against what the product actually requires.
6. **Serve everything over HTTPS**, host and feature alike.
7. **Keep dependencies updated** on both sides of the boundary, and pair that with the page-integrity
   controls this model deliberately leaves to you: Content Security Policy, Trusted Types,
   Subresource Integrity, and dependency provenance.

## Security Updates

Security updates will be released as patch versions and documented in the [CHANGELOG](https://github.com/AndrewRedican/hyperfrontend/releases) and GitHub Security Advisories.

## Supported Versions

Security updates are provided for the latest published version of each `@hyperfrontend/*` package.
Older releases receive no backports. A long-term support policy will replace this section once the
packages settle on a stable release cadence.
