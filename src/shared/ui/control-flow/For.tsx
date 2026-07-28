import { Fragment, type Key, type ReactNode } from 'react'

type ForProps<T> = {
  each: readonly T[] | null | undefined
  fallback?: ReactNode
  getKey?: (item: T, index: number) => Key
  children: (item: T, index: number) => ReactNode
}

export function For<T>({ each, fallback = null, getKey, children }: ForProps<T>) {
  if (!each || each.length === 0) return <>{fallback}</>

  return (
    <>
      {each.map((item, index) => (
        <Fragment key={getKey ? getKey(item, index) : index}>{children(item, index)}</Fragment>
      ))}
    </>
  )
}
