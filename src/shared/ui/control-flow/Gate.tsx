import type { ReactNode } from 'react'

type GateProps = {
  loading?: boolean
  error?: unknown
  empty?: boolean
  loadingFallback?: ReactNode
  errorFallback?: ReactNode | ((error: unknown) => ReactNode)
  emptyFallback?: ReactNode
  children: ReactNode
}

export function Gate({
  loading = false,
  error,
  empty = false,
  loadingFallback = null,
  errorFallback = null,
  emptyFallback = null,
  children,
}: GateProps) {
  if (loading) return <>{loadingFallback}</>

  if (error) {
    return <>{typeof errorFallback === 'function' ? errorFallback(error) : errorFallback}</>
  }

  if (empty) return <>{emptyFallback}</>

  return <>{children}</>
}
