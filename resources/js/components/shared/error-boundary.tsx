import { Component, type ErrorInfo, type ReactNode } from "react"

/**
 * Error boundary global. Mencegah white screen saat render crash:
 * komponen ini menangkap error render apa pun dan menampilkan fallback.
 *
 * Catatan: fallback sengaja TIDAK memakai Inertia (<Link>, routeUrl) karena
 * error bisa saja terjadi di dalam Inertia router sendiri — fallback hanya
 * memakai anchor/button native agar selalu berfungsi.
 */
interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary] render crash:", error, info.componentStack)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleHome = (): void => {
    window.location.href = "/"
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex min-h-[60dvh] w-full flex-col items-center justify-center px-4 py-16 text-center">
        <p className="font-display text-6xl font-bold tracking-tight text-foreground/15 sm:text-7xl">
          500
        </p>
        <h1 className="mt-4 max-w-xl font-display text-lg font-bold tracking-tight text-foreground">
          Terjadi gangguan sementara
        </h1>
        <p className="mt-3 max-w-lg text-base leading-7 text-muted-foreground">
          Ada masalah saat memuat halaman ini. Silakan muat ulang, atau kembali ke beranda.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-7 text-sm font-semibold text-white transition hover:bg-foreground/85"
          >
            Muat ulang halaman
          </button>
          <button
            type="button"
            onClick={this.handleHome}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-surface px-7 text-sm font-semibold text-foreground transition hover:bg-accent"
          >
            Ke Beranda
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
