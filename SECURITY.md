# Security Policy

## Reporting a Vulnerability

We take the security of hyperfrontend seriously. If you discover a security vulnerability, please help us protect our users by following responsible disclosure practices.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities directly via email to:

**andrew.redican.mejia@gmail.com**

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

When using hyperfrontend in your applications:

1. **Keep Dependencies Updated**: Regularly update to the latest version to receive security patches
2. **Content Security Policy**: Implement appropriate CSP headers when embedding features
3. **Input Validation**: Validate and sanitize all data passed between features
4. **Origin Verification**: Always verify the origin of messages in cross-frame communication
5. **Authentication**: Implement proper authentication and authorization for sensitive features
6. **HTTPS**: Always serve hyperfrontend features over HTTPS in production

## Security Updates

Security updates will be released as patch versions and documented in the [CHANGELOG](https://github.com/AndrewRedican/hyperfrontend/releases) and GitHub Security Advisories.

## Supported Versions

We currently provide security updates for:

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

As the project matures, we will update this table to reflect our long-term support policy.
