import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

import { useState, useEffect } from 'react'
import '../styles.css'
import { Sidebar } from '@/components/Sidebar'
import { ChatBot } from '@/components/ChatBot'
import { LoadingProvider } from '@/lib/loading-context'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Rebels Volleyball' },
    ],
    links: [
      { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      { rel: 'apple-touch-icon', href: '/logo.png' },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('tr_sidebar_collapsed')
    if (saved === 'true') setCollapsed(true)
    const handler = (e: Event) => setCollapsed((e as CustomEvent<boolean>).detail)
    window.addEventListener('tr_sidebar_collapsed_change', handler)
    return () => window.removeEventListener('tr_sidebar_collapsed_change', handler)
  }, [])

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--fg))]">
      <LoadingProvider>
        <Sidebar />
        <div className={`${collapsed ? 'md:ml-16' : 'md:ml-60'} pb-16 md:pb-0 min-h-screen transition-all duration-200`}>
          <Outlet />
        </div>
        <ChatBot />
      </LoadingProvider>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('tr_theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light')}})();",
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
