import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"

interface SectionRow {
  key: string
  enabled: boolean
  sort_order: number
  label: string
  description: string
  icon: string
  edit_href?: string | null
}

export default function BerandaIndex({
  title,
  description,
  sections: initialSections,
  submitUrl,
}: {
  title: string
  description: string
  sections: SectionRow[]
  submitUrl: string
}) {
  const [sections, setSections] = React.useState(initialSections)
  const [reorderMode, setReorderMode] = React.useState(false)
  const form = useForm({
    sections: initialSections.map((section) => ({
      key: section.key,
      enabled: section.enabled,
      sort_order: section.sort_order,
    })),
  })

  React.useEffect(() => {
    // Inertia refresh replaces the editable section list with the server snapshot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSections(initialSections)
    form.setData(
      "sections",
      initialSections.map((section) => ({
        key: section.key,
        enabled: section.enabled,
        sort_order: section.sort_order,
      })),
    )
    // `useForm` returns a new facade on every render; the server snapshot is the only dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSections])

  function syncForm(next: SectionRow[]) {
    const ordered = next.map((section, index) => ({ ...section, sort_order: index }))
    setSections(ordered)
    form.setData(
      "sections",
      ordered.map((section) => ({
        key: section.key,
        enabled: section.enabled,
        sort_order: section.sort_order,
      })),
    )
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    syncForm(next)
  }

  function toggleEnabled(index: number) {
    const next = sections.map((section, i) =>
      i === index ? { ...section, enabled: !section.enabled } : section,
    )
    syncForm(next)
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setReorderMode((value) => !value)}
          >
            {reorderMode ? "Nonaktifkan mode geser" : "Aktifkan mode geser"}
          </Button>
          <Button type="button" variant="secondary" asChild>
            <Link href={routeUrl("admin.beranda.index")}>Batal</Link>
          </Button>
          <Button
            type="button"
            disabled={form.processing}
            onClick={() => form.put(submitUrl)}
          >
            {form.processing ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <section className="space-y-3">
        {sections.map((section, index) => (
          <article
            key={section.key}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            {reorderMode ? (
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Naikkan ${section.label}`}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  disabled={index === sections.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Turunkan ${section.label}`}
                >
                  ↓
                </Button>
              </div>
            ) : (
              <span className="inline-flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon name={section.icon} className="size-5" aria-hidden="true" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold tracking-tight">{section.label}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
            </div>

            <button
              type="button"
              onClick={() => toggleEnabled(index)}
              className="inline-flex items-center gap-2 text-xs font-semibold"
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  section.enabled ? "bg-success" : "bg-muted-foreground/40",
                )}
              />
              <StatusBadge
                status={section.enabled ? "active" : "inactive"}
                label={section.enabled ? "Aktif" : "Nonaktif"}
              />
            </button>

            {section.edit_href ? (
              <Button asChild variant="secondary" size="xs" className="px-3">
                <Link href={section.edit_href}>Edit konten</Link>
              </Button>
            ) : null}
          </article>
        ))}
      </section>
    </AdminLayout>
  )
}
