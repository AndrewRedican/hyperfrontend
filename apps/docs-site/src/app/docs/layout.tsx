import { DocsChrome } from '@/components/docs-chrome'

type DocsLayoutProps = { children: React.ReactNode }

export default function DocsLayout({ children }: DocsLayoutProps) {
  return <DocsChrome>{children}</DocsChrome>
}
