// src/routes/stat-login.tsx
// Statistician login is now handled by Netlify Identity on /login
// This route redirects there for backwards compatibility

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/stat-login')({
  beforeLoad: () => {
    throw redirect({ to: '/login' })
  },
  component: () => null,
})
