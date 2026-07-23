import { usePage } from "@inertiajs/react"
import * as React from "react"

import { Alert } from "@/components/ui/alert"
import type { SharedPageProps } from "@/types"

const AUTO_DISMISS_MS = 4000

type FlashKey = "success" | "status" | "error"

export function FlashMessages() {
  const { flash } = usePage<SharedPageProps>().props
  const [dismissed, setDismissed] = React.useState<Record<FlashKey, boolean>>({
    success: false,
    status: false,
    error: false,
  })

  const success = flash?.success ?? null
  const status = flash?.status ?? null
  const error = flash?.error ?? null
  const signature = [success, status, error].join("|")

  React.useEffect(() => {
    setDismissed({ success: false, status: false, error: false })
  }, [signature])

  React.useEffect(() => {
    if (!success && !status && !error) return

    const timer = window.setTimeout(() => {
      setDismissed({ success: true, status: true, error: true })
    }, AUTO_DISMISS_MS)

    return () => window.clearTimeout(timer)
  }, [signature, success, status, error])

  const visibleSuccess = Boolean(success) && !dismissed.success
  const visibleStatus = Boolean(status) && !dismissed.status
  const visibleError = Boolean(error) && !dismissed.error

  if (!visibleSuccess && !visibleStatus && !visibleError) return null

  return (
    <div
      className="container-page fixed left-1/2 top-20 z-toast -translate-x-1/2 space-y-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {visibleSuccess ? (
        <Alert
          tone="success"
          title={success ?? undefined}
          className="ml-auto max-w-xl bg-surface shadow-float"
          onDismiss={() => setDismissed((prev) => ({ ...prev, success: true }))}
        />
      ) : null}
      {visibleStatus ? (
        <Alert
          tone="info"
          title={status ?? undefined}
          className="ml-auto max-w-xl bg-surface shadow-float"
          onDismiss={() => setDismissed((prev) => ({ ...prev, status: true }))}
        />
      ) : null}
      {visibleError ? (
        <Alert
          tone="danger"
          title={error ?? undefined}
          className="ml-auto max-w-xl bg-surface shadow-float"
          onDismiss={() => setDismissed((prev) => ({ ...prev, error: true }))}
        />
      ) : null}
    </div>
  )
}
