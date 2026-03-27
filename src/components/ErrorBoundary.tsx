import { Component, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('MapCards crashed:', error, info.componentStack)
  }

  handleReload = () => window.location.reload()

  handleReset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex h-dvh w-full items-center justify-center bg-sidebar-bg">
        <div className="mx-4 max-w-sm rounded-2xl border border-divider bg-white p-8 text-center shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <span className="text-xl">!</span>
          </div>
          <h2 className="text-[15px] font-semibold text-heading">Something went wrong</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-body">
            MapCards ran into an unexpected error. Your work has been auto-saved.
          </p>
          {this.state.error && (
            <p className="mt-3 rounded-lg bg-input-bg px-3 py-2 text-left font-mono text-[11px] text-body">
              {this.state.error.message}
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button
              onClick={this.handleReset}
              className="flex-1 rounded-lg border border-divider px-4 py-2.5 text-[13px] font-medium text-heading transition-colors hover:bg-input-bg"
            >
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              <RefreshCw size={14} strokeWidth={2} />
              Reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}
