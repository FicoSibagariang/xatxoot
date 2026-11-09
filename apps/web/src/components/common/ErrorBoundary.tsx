import React, { Component, type ErrorInfo, type ReactNode } from 'react'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  variant?: 'root' | 'panel' | 'inline'
  onReset?: () => void
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  fallbackRender?: (props: { error: Error; resetErrorBoundary: () => void }) => ReactNode
}

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo)
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.()
    this.state = {
      hasError: false,
      error: null,
    }
    try {
      this.setState({
        hasError: false,
        error: null,
      })
    } catch {
      // ignore if unmounted
    }
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallbackRender) {
        return this.props.fallbackRender({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
        })
      }

      const { variant = 'panel', fallbackTitle, fallbackMessage } = this.props
      const errorMsg = this.state.error.message || 'Terjadi kesalahan internal yang tidak terduga.'

      if (variant === 'root') {
        return (
          <div
            className="min-h-screen w-full bg-[#111b21] text-[#e9edef] flex flex-col items-center justify-center p-6 select-none"
            data-testid="error-boundary-root"
          >
            <div className="max-w-md w-full bg-[#202c33] border border-[#313d45] rounded-xl p-8 shadow-2xl text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-5 text-rose-400">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Ikon Peringatan Error</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>

              <h2 className="text-xl font-semibold text-[#e9edef] mb-2">
                {fallbackTitle || 'Terjadi Kesalahan pada Aplikasi'}
              </h2>
              <p className="text-sm text-[#8696a0] mb-6 leading-relaxed">
                {fallbackMessage ||
                  'Aplikasi mengalami kendala tak terduga saat memuat antarmuka. Anda dapat mencoba memuat ulang halaman untuk memulihkan sesi.'}
              </p>

              <div className="w-full bg-[#111b21] p-3 rounded-lg text-xs font-mono text-rose-300 text-left mb-6 overflow-x-auto border border-[#2a3942]">
                {errorMsg}
              </div>

              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.location.reload()
                    } else {
                      this.resetErrorBoundary()
                    }
                  }}
                  className="flex-1 bg-[#00a884] hover:bg-[#008f70] active:scale-[0.98] text-[#111b21] font-medium py-2.5 px-4 rounded-lg transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-[#00a884]/50"
                >
                  Muat Ulang Halaman
                </button>
                <button
                  type="button"
                  onClick={this.resetErrorBoundary}
                  className="px-4 py-2.5 rounded-lg border border-[#313d45] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors font-medium text-sm"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          </div>
        )
      }

      if (variant === 'inline') {
        return (
          <div
            className="flex items-center gap-3 p-3 bg-rose-950/20 border border-rose-800/40 rounded-lg text-xs text-rose-300 my-2"
            data-testid="error-boundary-inline"
          >
            <span className="font-semibold">{fallbackTitle || 'Gagal memuat'}:</span>
            <span className="truncate flex-1">{errorMsg}</span>
            <button
              type="button"
              onClick={this.resetErrorBoundary}
              className="text-xs text-emerald-400 hover:underline font-medium shrink-0"
            >
              Muat Ulang Komponen
            </button>
          </div>
        )
      }

      // Default: panel variant (contoh untuk panel chat / panel conversation)
      return (
        <div
          className="h-full w-full min-h-[300px] flex flex-col items-center justify-center p-8 bg-[#0c1317] text-[#8696a0] text-center"
          data-testid="error-boundary-panel"
        >
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>Ikon Peringatan Komponen</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h3 className="text-base font-medium text-[#e9edef] mb-1">
            {fallbackTitle || 'Terjadi kesalahan pada komponen'}
          </h3>
          <p className="text-xs text-[#8696a0] max-w-sm mb-5 leading-relaxed">
            {fallbackMessage ||
              'Bagian ini mengalami kendala rendering. Komponen lain di aplikasi tetap dapat digunakan secara normal.'}
          </p>

          <button
            type="button"
            onClick={this.resetErrorBoundary}
            className="inline-flex items-center gap-2 bg-[#202c33] hover:bg-[#2a3942] border border-[#313d45] text-[#00a884] hover:text-[#25d366] text-xs font-medium py-2 px-4 rounded-lg transition-colors shadow-sm"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>Ikon Muat Ulang</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Muat Ulang Komponen
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
