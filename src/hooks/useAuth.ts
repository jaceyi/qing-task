import { useEffect, useState } from 'react'
import { getRedirectResult, onAuthStateChanged, type User } from 'firebase/auth'
import { auth, prepareAuth } from '../lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    prepareAuth()
      .then(() => getRedirectResult(auth))
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : '登录初始化失败')
      })

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        if (!active) return
        setUser(nextUser)
        setLoading(false)
      },
      (reason) => {
        if (!active) return
        setError(reason.message)
        setLoading(false)
      },
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return { user, loading, error, setError }
}
