import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { DocsNavbar } from '@/components/docs-navbar'
import { DocsSidebar } from '@/components/docs-sidebar'
import { getAllDocs } from '@/lib/docs'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Zentropy Docs',
  description: 'Minimalist documentation for Zentropy',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const docs = getAllDocs()

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative flex min-h-screen flex-col">
            <DocsNavbar />
            <div className="flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
              <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block">
                <DocsSidebar docs={docs} />
              </aside>
              <main className="relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px] px-4 md:px-0">
                {children}
                {/* TableOfContents could go here in the xl grid col */}
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
