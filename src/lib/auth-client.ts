import { useEffect, useState } from 'react'
import { getUser, onAuthChange, type User } from '@netlify/identity'

export type AuthState = {
  user: User | null
  isAdmin: boolean
  isStatistician: boolean
  isMember: boolean
  hasStatAccess: boolean  // admin OR statistician
  isLoggedIn: boolean     // any authenticated user
  loading: boolean
}

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false
  const roles = (user.appMetadata?.roles ?? []) as string[]
  return roles.includes('admin')
}

export function isStatisticianUser(user: User | null | undefined): boolean {
  if (!user) return false
  const roles = (user.appMetadata?.roles ?? []) as string[]
  return roles.includes('statistician')
}

export function isMemberUser(user: User | null | undefined): boolean {
  if (!user) return false
  const roles = (user.appMetadata?.roles ?? []) as string[]
  // admin and statistician also get member privileges
  return roles.includes('member') || roles.includes('admin') || roles.includes('statistician')
}

export function hasStatAccess(user: User | null | undefined): boolean {
  return isAdminUser(user) || isStatisticianUser(user)
}

export function getUserDisplayName(user: User | null | undefined): string {
  if (!user) return 'Guest'
  return user.userMetadata?.full_name || user.email?.split('@')[0] || 'Member'
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // 3s timeout fallback in case Identity SDK hangs
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 3000)

    getUser()
      .then((u) => {
        if (!cancelled) setUser(u ?? null)
      })
      .catch(() => { /* Identity not configured — treat as logged out */ })
      .finally(() => {
        clearTimeout(timeout)
        if (!cancelled) setLoading(false)
      })

    const unsubscribe = onAuthChange((_event, nextUser) => {
      setUser(nextUser ?? null)
    })

    return () => {
      cancelled = true
      clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  return {
    user,
    isAdmin: isAdminUser(user),
    isStatistician: isStatisticianUser(user),
    isMember: isMemberUser(user),
    hasStatAccess: hasStatAccess(user),
    isLoggedIn: !!user,
    loading,
  }
}
