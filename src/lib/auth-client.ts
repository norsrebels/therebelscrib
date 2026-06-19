import { useEffect, useState } from 'react'
import { getUser, onAuthChange, type User } from '@netlify/identity'

export type AuthState = {
  user: User | null
  isAdmin: boolean
  loading: boolean
}

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false
  const roles = (user.appMetadata?.roles ?? []) as string[]
  return roles.includes('admin')
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getUser()
      .then((u) => {
        if (!cancelled) setUser(u ?? null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const unsubscribe = onAuthChange((_event, nextUser) => {
      setUser(nextUser ?? null)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return { user, isAdmin: isAdminUser(user), loading }
}
