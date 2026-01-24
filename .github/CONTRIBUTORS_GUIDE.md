# Contributors & Funding Management Guide

This guide explains how to manage contributors recognition and funding for the hyperfrontend project.

## Table of Contents

- [Automated Contributors](#automated-contributors)
- [All Contributors Setup](#all-contributors-setup)
- [Adding Contributors](#adding-contributors)
- [Funding Setup](#funding-setup)
- [Recognition Types](#recognition-types)

## Automated Contributors

**Good news!** Contributors from merged PRs are automatically added! 🎉

See [AUTOMATED_CONTRIBUTORS.md](AUTOMATED_CONTRIBUTORS.md) for full details.

### Quick Summary

- ✅ **Automatic**: Contributors are auto-added when PRs from forks are merged
- 💬 **Via Comments**: Use `@all-contributors please add @username for code` in any issue/PR
- 🔧 **Manual**: Use `npm run contributors:add` if automation fails

The workflow handles everything automatically, but you can still manage contributors manually if needed.

## All Contributors Setup

### What is All Contributors?

[All Contributors](https://allcontributors.org) is a specification for recognizing all contributors to a project, not just code contributors. It automatically generates a contributors section in your README with avatars and contribution types.

### Configuration

The configuration is in [.all-contributorsrc](.all-contributorsrc) and includes:

- Project name and owner
- Contributors list with their contribution types
- Badge and template settings
- Commit conventions

### Files Modified

All Contributors automatically manages:

- `README.md` - Contributors section and badge
- `.all-contributorsrc` - Contributors database

## Adding Contributors

### Interactive Method (Recommended)

Use the interactive CLI to add a contributor:

```bash
npm run contributors:add
```

This will prompt you for:

1. GitHub username or name
2. Contribution type(s)

### Command Line Method

Add a contributor directly:

```bash
# Add a code contributor
npm run contributors:add -- AndrewRedican code

# Add multiple contribution types
npm run contributors:add -- username code,doc,design
```

### Manual Method

Edit `.all-contributorsrc` directly and add to the `contributors` array:

```json
{
  "login": "username",
  "name": "Full Name",
  "avatar_url": "https://github.com/username.png",
  "profile": "https://github.com/username",
  "contributions": ["code", "doc"]
}
```

Then regenerate:

```bash
npm run contributors:generate
```

## Recognition Types

All Contributors supports many contribution types:

| Emoji | Type              | Description              |
| ----- | ----------------- | ------------------------ |
| 💻    | code              | Code contributions       |
| 📖    | doc               | Documentation            |
| 🎨    | design            | Design                   |
| 🐛    | bug               | Bug reports              |
| 💡    | ideas             | Ideas & Planning         |
| 🤔    | ideas             | Ideas & Planning (alias) |
| 🚇    | infra             | Infrastructure           |
| 🚧    | maintenance       | Maintenance              |
| 📆    | projectManagement | Project Management       |
| 👀    | review            | Reviewed Pull Requests   |
| ⚠️    | test              | Tests                    |
| 🔧    | tool              | Tools                    |
| 🌍    | translation       | Translation              |
| ✅    | tutorial          | Tutorials                |
| 💬    | question          | Answering Questions      |
| 📢    | talk              | Talks                    |
| 📝    | blog              | Blog posts               |
| 💵    | financial         | Financial support        |
| 🔍    | fundingFinding    | Funding finding          |
| 📋    | eventOrganizing   | Event organizing         |
| 🎥    | video             | Videos                   |
| 📓    | example           | Examples                 |
| 🔌    | plugin            | Plugin/utility libraries |
| 📦    | platform          | Packaging/porting        |
| 🚀    | mentoring         | Mentoring                |

### Examples

```bash
# Code contributor
npm run contributors:add -- username code

# Documentation writer
npm run contributors:add -- username doc

# Designer
npm run contributors:add -- username design

# Bug reporter
npm run contributors:add -- username bug

# Financial supporter
npm run contributors:add -- username financial

# Multiple types
npm run contributors:add -- username code,doc,test,review
```

## Funding Setup

### GitHub Sponsors

The project is configured for GitHub Sponsors:

1. **FUNDING.yml**: Located at `.github/FUNDING.yml`
2. **Sponsor Button**: Shows "Sponsor" button on GitHub repository
3. **Sponsor Link**: https://github.com/sponsors/AndrewRedican

### Setting Up GitHub Sponsors

1. Go to https://github.com/sponsors
2. Click "Join the waitlist" or "Set up GitHub Sponsors"
3. Complete the sponsor profile:
   - Add bio and sponsorship tiers
   - Set up payment information
   - Configure sponsorship goals
4. Once approved, the sponsor button will appear on your repository

### Package.json Funding Field

The `package.json` includes a `funding` field:

```json
"funding": {
  "type": "github",
  "url": "https://github.com/sponsors/AndrewRedican"
}
```

This shows funding info when users run `npm fund`.

### Funding Documentation

See [FUNDING.md](../FUNDING.md) for:

- Why support the project
- How to support (GitHub Sponsors, one-time donations)
- Corporate sponsorship tiers
- Other ways to contribute
- Recognition and transparency

## Workflow

### Adding a New Contributor

1. **Add the contributor**:

   ```bash
   npm run contributors:add
   ```

2. **Follow the prompts**:
   - Enter GitHub username or name
   - Select contribution type(s)

3. **The tool will automatically**:
   - Update `.all-contributorsrc`
   - Update `README.md` with the new contributor
   - Create a commit (if configured)

4. **Review and commit**:
   ```bash
   git add .all-contributorsrc README.md
   git commit -m "docs: add @username as a contributor"
   ```

### Checking Contributors

Verify all contributors are properly recognized:

```bash
npm run contributors:check
```

This checks if anyone is missing from the contributors list.

### Regenerating Contributors Section

If you manually edit `.all-contributorsrc`, regenerate the README section:

```bash
npm run contributors:generate
```

## Best Practices

### When to Add Contributors

Add contributors when they:

- ✅ Submit a merged pull request (code, doc, etc.)
- ✅ Report a significant bug with reproduction steps
- ✅ Provide valuable feedback or ideas
- ✅ Help answer questions in issues/discussions
- ✅ Create tutorials, blog posts, or videos
- ✅ Sponsor the project financially
- ✅ Help with design, testing, or infrastructure

### Multiple Contribution Types

Many contributors help in multiple ways:

```bash
# Example: Someone who codes, writes docs, and reviews PRs
npm run contributors:add -- username code,doc,review
```

### Keep It Updated

- Add new contributors promptly after their contribution
- Update contribution types as contributors expand their involvement
- Celebrate all contributions, not just code!

## Recognizing Financial Supporters

### GitHub Sponsors

GitHub Sponsors are automatically recognized through the sponsor badge and FUNDING.yml.

For additional recognition:

1. Add them to the contributors list:

   ```bash
   npm run contributors:add -- username financial
   ```

2. Update `FUNDING.md` with sponsor tier (Bronze/Silver/Gold/Platinum)

3. Add sponsor logo to README if applicable (for higher tiers)

### One-time Donors

Recognize one-time donors by:

1. Adding them with the `financial` type
2. Listing them in `FUNDING.md` under "Individual Sponsors"

## Commands Reference

```bash
# Add a contributor interactively
npm run contributors:add

# Add a contributor with specific types
npm run contributors:add -- username type1,type2

# Regenerate the contributors section
npm run contributors:generate

# Check for missing contributors
npm run contributors:check

# View funding information
npm fund
```

## Resources

- [All Contributors Specification](https://allcontributors.org)
- [All Contributors CLI Docs](https://allcontributors.org/docs/en/cli/overview)
- [GitHub Sponsors Docs](https://docs.github.com/en/sponsors)
- [npm Funding Field](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#funding)

## Questions?

For questions about contributors or funding:

**Email**: andrew.redican.mejia@gmail.com
**GitHub**: [@AndrewRedican](https://github.com/AndrewRedican)

---

**Remember**: Every contribution matters! Whether it's code, documentation, bug reports, or financial support, all contributions help make hyperfrontend better. 🚀
