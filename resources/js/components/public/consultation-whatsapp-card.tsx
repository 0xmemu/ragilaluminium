import * as React from "react"
import { Link, useForm, usePage } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FilterSidebarCard } from "@/components/public/filter-sidebar"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

const PHONE_REQUIRED = "Nomor WhatsApp wajib diisi."

export function ConsultationWhatsAppCard({
  source = "model_produk",
  title = "Butuh Ukuran Khusus?",
}: {
  source?: string
  title?: string
}) {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const phoneInputRef = React.useRef<HTMLInputElement>(null)
  const form = useForm({
    phone: "",
    source,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const phone = form.data.phone.trim()

    if (!phone) {
      form.setError("phone", PHONE_REQUIRED)
      phoneInputRef.current?.focus()
      return
    }

    form.clearErrors("phone")
    form.post(routeUrl("consultation.whatsapp.send"), {
      preserveScroll: true,
    })
  }

  return (
    <FilterSidebarCard>
      <h2 className="text-sm font-bold capitalize text-foreground">{title}</h2>

      <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
        <FormErrorSummary errors={form.errors} />
        <Field
          id={`consultation-phone-${source}`}
          label={consultationWhatsApp?.phoneLabel ?? "Nomor HP/WhatsApp"}
          hint={consultationWhatsApp?.phoneHint ?? "*Kami akan langsung menghubungi Anda"}
          required
          error={form.errors.phone}
        >
          <Input
            ref={phoneInputRef}
            type="tel"
            value={form.data.phone}
            onChange={(event) => {
              form.setData("phone", event.target.value)
              if (form.errors.phone) {
                form.clearErrors("phone")
              }
            }}
            autoComplete="tel"
            inputMode="tel"
            placeholder="08xxxxxxxxxx"
            className={
              form.errors.phone
                ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                : undefined
            }
          />
        </Field>
        <Button type="submit" className="w-full" disabled={form.processing}>
          <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
          {form.processing
            ? "Mengirim..."
            : (consultationWhatsApp?.submitLabel ?? "Konsultasi")}
        </Button>
      </form>

      {consultationWhatsApp?.directUrl ? (
        <Button asChild variant="secondary" className="mt-3 w-full">
          <a href={consultationWhatsApp.directUrl} target="_blank" rel="noreferrer">
            <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
            {consultationWhatsApp.directLabel}
          </a>
        </Button>
      ) : (
        <Button asChild variant="secondary" className="mt-3 w-full">
          <Link href={routeUrl("contact")}>Hubungi Kami</Link>
        </Button>
      )}
    </FilterSidebarCard>
  )
}
