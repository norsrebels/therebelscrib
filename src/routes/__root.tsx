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

// Token types that Netlify Identity puts in the URL hash
const IDENTITY_HASH_TOKENS = [
  'invite_token',
  'recovery_token',
  'confirmation_token',
  'access_token', // OAuth callback
]

function RootLayout() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('tr_sidebar_collapsed')
    if (saved === 'true') setCollapsed(true)
    const handler = (e: Event) => setCollapsed((e as CustomEvent<boolean>).detail)
    window.addEventListener('tr_sidebar_collapsed_change', handler)
    return () => window.removeEventListener('tr_sidebar_collapsed_change', handler)
  }, [])

  // Global Netlify Identity hash handler
  // When a user clicks an invite/recovery/confirmation email link, Netlify
  // appends a token to the URL hash (e.g. /#invite_token=XXX). If they land
  // on any page other than /login the token gets ignored. This hook intercepts
  // the hash on every page load and redirects to /login so handleAuthCallback()
  // can process it correctly.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash) return

    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const hasIdentityToken = IDENTITY_HASH_TOKENS.some(key => params.has(key))

    if (hasIdentityToken && !window.location.pathname.startsWith('/login')) {
      // Preserve the full hash so login page can read the token
      window.location.replace('/login' + window.location.hash)
    }
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
