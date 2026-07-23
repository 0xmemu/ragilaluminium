import { formatCurrency, formatDate, humanize } from "@/lib/format"
import { StatusBadge } from "@/components/ui/status-badge"

export function ResourceValue({
  fieldKey,
  value,
  format,
}: {
  fieldKey?: string
  value: unknown
  format?: string
}) {
  if (format === "idr") {
    return <span className="tabular-nums font-semibold">{formatCurrency(value as number | string)}</span>
  }

  if (format === "date" || format === "datetime" || fieldKey?.endsWith("_at")) {
    return <span className="tabular-nums">{formatDate(value as string, format !== "date")}</span>
  }

  if (
    fieldKey?.includes("status") ||
    fieldKey === "visibility" ||
    fieldKey === "published" ||
    fieldKey === "direction"
  ) {
    return <StatusBadge status={value} />
  }

  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1">
        {value.map((item, index) => (
          <li key={index}>{humanize(item)}</li>
        ))}
      </ul>
    )
  }

  if (typeof value === "object" && value !== null) {
    return (
      <pre className="max-w-full overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-5">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  return <span>{humanize(value)}</span>
}
