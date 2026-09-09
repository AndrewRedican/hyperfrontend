import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { DOC_MEASURE_CLASS, docLayout } from '@/lib/doc-layout'
import { navVisibility } from '@/lib/nav-visibility'

type DocsLayoutProps = { children: React.ReactNode }

export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <>
      <Header width={docLayout.shell} />
      <div className={`flex ${docLayout.shell} ${docLayout.gutter}`}>
        {/* Sidebar - the mobile drawer covers every width below this one, sticky on desktop */}
        <aside className={`sticky top-16 h-[calc(100vh-4rem)] self-start dark:border-slate-700 ${navVisibility.sidebar}`}>
          <Sidebar />
        </aside>

        {/* Main Content */}
        <main id="main-content" className={`min-w-0 flex-1 py-10 lg:pl-8 ${DOC_MEASURE_CLASS}`}>
          {children}
        </main>
      </div>
      <Footer width={docLayout.shell} />
    </>
  )
}
