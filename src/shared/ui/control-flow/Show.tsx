import type { ReactNode } from 'react'

type ShowProps<T> = {
  when: T | null | undefined | false
  fallback?: ReactNode
  children: ReactNode | ((value: T) => ReactNode)
}

export function Show<T>({ when, fallback = null, children }: ShowProps<T>) {
  if (!when) return <>{fallback}</>

  return <>{typeof children === 'function' ? children(when) : children}</>
}
