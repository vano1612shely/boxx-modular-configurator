import { Suspense, type ComponentType, type ReactNode } from 'react'

import { ErrorBoundary } from '../ui/error-boundary'

type WithModuleOptions = {
  errorFallback?: ReactNode | ((error: Error) => ReactNode)
  loadingFallback?: ReactNode
}

export function withModule<P extends object>(
  Entry: ComponentType<P>,
  { errorFallback = null, loadingFallback = null }: WithModuleOptions = {},
) {
  function Module(props: P) {
    return (
      <ErrorBoundary fallback={errorFallback}>
        <Suspense fallback={loadingFallback}>
          <Entry {...props} />
        </Suspense>
      </ErrorBoundary>
    )
  }

  Module.displayName = `withModule(${Entry.displayName ?? Entry.name ?? 'Module'})`

  return Module
}
