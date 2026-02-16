# HyperFrontend Documentation Site

Next.js documentation site for the HyperFrontend framework.

## Development

This project uses self-contained dependencies. Install and run with:

```bash
# Install dependencies
npx nx install docs-site

# Start development server
npx nx serve docs-site

# Build for production
npx nx build docs-site
```

## Structure

```
src/
├── app/           # Next.js App Router pages
├── components/    # React components
├── lib/           # Utility functions
└── styles/        # Global CSS and Tailwind
```

## Deployment

This site is deployed to Vercel. See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for setup instructions.
