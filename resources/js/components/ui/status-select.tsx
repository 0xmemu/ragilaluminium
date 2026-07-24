import * as React from "react"

import { Select } from "@/components/ui/select"
import { statusMeta } from "@/lib/status"

export function StatusSelect({
  statuses,
  ...props
}: { statuses: readonly string[] } & React.ComponentPropsWithoutRef<typeof Select>) {
  return (
    <Select {...props}>
      {statuses.map((s) => (
        <option key={s} value={s}>
          {statusMeta(s).label}
        </option>
      ))}
    </Select>
  )
}
