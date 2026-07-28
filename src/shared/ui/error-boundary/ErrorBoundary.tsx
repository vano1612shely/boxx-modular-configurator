'use client'

import { Component, type PropsWithChildren, type ReactNode } from 'react'

type Props = PropsWithChildren<{
  fallback?: ReactNode | ((error: Error) => ReactNode)
  onError?: (error: Error) => void
}>

type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error)
  }

  render() {
    const { error } = this.state
    const { fallback = null, children } = this.props

    if (error) {
      return typeof fallback === 'function' ? fallback(error) : fallback
    }

    return children
  }
}
