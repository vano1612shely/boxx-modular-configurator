import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'

type MatchProps<T> = {
  when: T | null | undefined | false
  children: ReactNode | ((value: T) => ReactNode)
}

/** Rendered only as a branch of <Switch> — returns nothing on its own. */
export function Match<T>(_props: MatchProps<T>) {
  return null
}

type SwitchProps = {
  fallback?: ReactNode
  children: ReactNode
}

export function Switch({ fallback = null, children }: SwitchProps) {
  const branches = Children.toArray(children).filter(
    (child): child is ReactElement<MatchProps<unknown>> =>
      isValidElement(child) && child.type === Match,
  )

  for (const branch of branches) {
    const { when, children: branchChildren } = branch.props

    if (when) {
      return <>{typeof branchChildren === 'function' ? branchChildren(when) : branchChildren}</>
    }
  }

  return <>{fallback}</>
}
