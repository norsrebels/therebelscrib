import { useState, useCallback } from 'react'

export type Toast = { msg: string; type: 'success' | 'error' } | null

export function useToast() {
  const [toast, setToast] = useState<Toast>(null)
  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])
  return { toast, showToast }
}
