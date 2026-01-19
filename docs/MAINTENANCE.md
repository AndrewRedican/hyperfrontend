# Documentation Maintenance Guide

## Overview

The hyperfrontend documentation is built with Hugo and the Hextra theme. Content is **automatically extracted** from `README.md` using a programmatic script, ensuring documentation stays in sync with the main README.

## TODO

- [ ] Improve content extraction automation
  - [ ] Auto-extract package READMEs from individual package directories
  - [ ] Generate API documentation from TypeScript definitions
  - [ ] Auto-update demo screenshots
  - [ ] Parse CHANGELOG.md for version history pages

## Architecture

```
docs/
├── scripts/
│   └── extract-readme.js     # Programmatic README content extractor
├── content/                  # Generated Hugo content (DO NOT EDIT MANUALLY)
│   ├── _index.md            # Homepage (auto-generated)
│   └── docs/
│       ├── _index.md        # Docs index (manually maintained)
│       ├── getting-started.md # Auto-generated from README
│       ├── concepts.md       # Auto-generated from README
│       ├── packages.md       # Auto-generated from README
│       └── demos.md          # Auto-generated from README
├── layouts/
│   └── shortcodes/
│       └── callout.html     # Custom callout component
├── assets/
│   └── css/
│       └── custom.css       # Professional styling
└── hugo.toml                # Hugo configuration
```

## How It Works

### 1. Content Extraction

The `extract-readme.js` script:
- Parses `README.md` into structured sections
- Transforms content into Hugo-compatible markdown
- Adds appropriate frontmatter
- Injects custom shortcodes (callouts, cards, etc.)

### 2. Build Process

```bash
# Development (with live reload)
npx nx serve docs

# Extract README content
npx nx extract docs

# Production build (automatically runs extract)
npx nx build docs
```

The build process automatically:
1. Runs `extract-readme.js` to generate content
2. Processes markdown with Hugo
3. Applies custom CSS and theme
4. Generates static site

### 3. Deployment

GitHub Actions automatically deploys on push to `main`:
1. Extracts README content
2. Builds with Hugo
3. Deploys to GitHub Pages

## Making Changes

### Updating Content

**✅ DO**: Edit `README.md` in the root directory
**❌ DON'T**: Manually edit generated files in `docs/content/docs/`

After updating README:
```bash
npx nx extract docs
npx nx serve docs  # Preview changes
```

### Customizing Styles

Edit `/workspaces/hyperfrontend/docs/assets/css/custom.css`:

```css
/* Brand Colors */
:root {
  --hf-primary: #4f46e5;
  --hf-primary-hover: #4338ca;
  /* ... */
}
```

All styles are:
- Responsive (mobile-first)
- Accessible (WCAG 2.1 AA)
- Dark mode compatible
- Performance optimized

### Adding Custom Components

Create shortcodes in `docs/layouts/shortcodes/`:

```html
<!-- Example: callout.html -->
{{- $type := .Get "type" | default "info" -}}
<div class="callout callout-{{ $type }}">
  {{ .Inner | markdownify }}
</div>
```

Usage in markdown:
```markdown
{{< callout type="info" >}}
  Your message here
{{< /callout >}}
```

### Modifying Extraction Logic

Edit `docs/scripts/extract-readme.js`:

```javascript
function generateGettingStarted(readmeData) {
  const { sections } = readmeData;

  // Add custom transformation logic here

  return `---
title: Getting Started
---

${sections['Installation']}
`;
}
```

## Available Shortcodes

### Callout
```markdown
{{< callout type="info|warning|error|success|tip" >}}
  Your message
{{< /callout >}}
```

### Cards
```markdown
{{< cards >}}
  {{< card link="/docs/page" title="Title" icon="icon-name" >}}
    Description
  {{< /card >}}
{{< /cards >}}
```

### Feature Grid
```markdown
{{< hextra/feature-grid >}}
  {{< hextra/feature-card title="Title" icon="icon" subtitle="Text" >}}
{{< /hextra/feature-grid >}}
```

## Styling Guidelines

### Color System
- **Primary**: `--hf-primary` - Main brand color
- **Secondary**: `--hf-secondary` - Accent color
- **Success**: `--hf-success` - Positive actions
- **Warning**: `--hf-warning` - Cautions
- **Error**: `--hf-error` - Errors

### Typography Scale
- **h1**: 2.5rem (Hero headings)
- **h2**: 2rem (Section headings)
- **h3**: 1.5rem (Subsections)
- **Body**: 1rem (16px base)

### Spacing Scale
- **xs**: 0.25rem
- **sm**: 0.5rem
- **md**: 1rem
- **lg**: 1.5rem
- **xl**: 2rem
- **2xl**: 3rem

## Performance

### Optimizations Applied
- ✅ Minified CSS/JS in production
- ✅ Lazy-loaded images
- ✅ Optimized fonts
- ✅ Efficient Hugo rendering
- ✅ Static site generation

### Build Metrics
- Build time: ~2-3 seconds
- Page weight: ~50KB (gzipped)
- Lighthouse score: 95+

## Troubleshooting

### Content not updating
```bash
# Clear Hugo cache
npx nx clean docs

# Re-extract and build
npx nx extract docs
npx nx serve docs
```

### Styles not applying
1. Check `hugo.toml` has `customCSS = ["css/custom.css"]`
2. Verify CSS file exists in `docs/assets/css/custom.css`
3. Clear browser cache

### Extract script fails
```bash
# Check Node.js version (needs 18+)
node --version

# Run script directly with verbose output
cd docs
node scripts/extract-readme.js
```

## Contributing

When contributing documentation:

1. **Update README.md** (not generated files)
2. **Run extraction**: `npx nx extract docs`
3. **Preview locally**: `npx nx serve docs`
4. **Test responsiveness** (mobile, tablet, desktop)
5. **Verify dark mode** works correctly
6. **Check accessibility** (keyboard navigation, screen readers)

## Resources

- **Hugo**: https://gohugo.io/documentation/
- **Hextra Theme**: https://imfing.github.io/hextra/
- **Markdown Guide**: https://www.markdownguide.org/
- **CSS Variables**: https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties

---

**Questions?** Open an issue or discussion on GitHub.
