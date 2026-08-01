import { usePage } from "@inertiajs/react"
import * as React from "react"

import { Alert } from "@/components/admin/ui/alert"
import type { SharedPageProps } from "@/types"

const AUTO_DISMISS_MS = 4000

type FlashKey = "success" | "status" | "error"

function FlashMessagesInner({
  success,
  status,
  error,
}: {
  success: string | null
  status: string | null
  error: string | null
}) {
  const [dismissed, setDismissed] = React.useState<Record<FlashKey, boolean>>({
    success: false,
    status: false,
    error: false,
  })

  React.useEffect(() => {
    if (!success && !status && !error) return

    const timer = window.setTimeout(() => {
      setDismissed({ success: true, status: true, error: true })
    }, AUTO_DISMISS_MS)

    return () => window.clearTimeout(timer)
  }, [success, status, error])

  const visibleSuccess = Boolean(success) && !dismissed.success
  const visibleStatus = Boolean(status) && !dismissed.status
  const visibleError = Boolean(error) && !dismissed.error

  if (!visibleSuccess && !visibleStatus && !visibleError) return null

  return (
    <div
      className="fixed inset-x-0 top-16 z-toast mx-auto flex w-full max-w-lg flex-col gap-2 px-4"
      aria-live="polite"
      aria-atomic="true"
    >
      {visibleSuccess ? (
        <Alert
          tone="success"
          title={success ?? undefined}
          className="bg-card shadow-float"
          onDismiss={() => setDismissed((prev) => ({ ...prev, success: true }))}
        />
      ) : null}
      {visibleStatus ? (
        <Alert
          tone="info"
          title={status ?? undefined}
          className="bg-card shadow-float"
          onDismiss={() => setDismissed((prev) => ({ ...prev, status: true }))}
        />
      ) : null}
      {visibleError ? (
        <Alert
          tone="danger"
          title={error ?? undefined}
          className="bg-card shadow-float"
          onDismiss={() => setDismissed((prev) => ({ ...prev, error: true }))}
        />
      ) : null}
    </div>
  )
}

export function FlashMessages() {
  const { flash } = usePage<SharedPageProps>().props
  const success = flash?.success ?? null
  const status = flash?.status ?? null
  const error = flash?.error ?? null
  const signature = [success, status, error].join("|")

  // Remount on new flash payload instead of resetting dismiss state in an effect.
  return (
    <FlashMessagesInner
      key={signature}
      success={success}
      status={status}
      error={error}
    />
  )
}
