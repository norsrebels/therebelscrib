import { getUser, type User } from '@netlify/identity'

export async function getAdminUser(): Promise<User | null> {
  const user = await getUser()
  if (!user) return null
  const roles = (user.appMetadata?.roles ?? []) as string[]
  return roles.includes('admin') ? user : null
}

export async function requireAdmin(): Promise<User | Response> {
  const user = await getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const roles = (user.appMetadata?.roles ?? []) as string[]
  if (!roles.includes('admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return user
}

// Accepts both admin and statistician roles — used by VIS Stats entry functions
export async function requireStatAccess(): Promise<User | null> {
  const user = await getUser()
  if (!user) return null
  const roles = (user.appMetadata?.roles ?? []) as string[]
  if (roles.includes('admin') || roles.includes('statistician')) return user
  return null
}

// Helper to get current user's identity info for audit logging
export async function getStatIdentity(): Promise<{
  userId: string
  email: string
  role: string
} | null> {
  const user = await getUser()
  if (!user) return null
  const roles = (user.appMetadata?.roles ?? []) as string[]
  const role = roles.includes('admin') ? 'admin' : roles.includes('statistician') ? 'statistician' : 'viewer'
  return {
    userId: user.id,
    email: user.email ?? 'unknown',
    role,
  }
}
