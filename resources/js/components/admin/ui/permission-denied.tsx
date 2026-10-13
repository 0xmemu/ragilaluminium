import { Link } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { routeUrl } from "@/lib/routes"

/**
 * State reusable utk akses ditolak / aksi tanpa capability (Permission UX
 * contract, Foundation Track A). BUKAN pengganti authorization server.
 */
export function PermissionDeniedState({
  title = "Kamu tidak punya akses",
  description = "Aksi ini membutuhkan hak akses khusus. Hubungi admin bila kamu merasa ini keliru.",
  backHref,
  backLabel = "Kembali",
}: {
  title?: string
  description?: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <EmptyState
      className="min-h-48"
      icon="lock"
      title={title}
      description={description}
      action={
        <Button asChild variant="outline" size="sm">
          <Link href={backHref ?? routeUrl("admin.dashboard")}>{backLabel}</Link>
        </Button>
      }
    />
  )
}
