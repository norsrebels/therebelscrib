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
