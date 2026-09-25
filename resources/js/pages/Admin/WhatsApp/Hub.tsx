import { Head, Link, router, usePage } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import {
  WhatsAppConnectionCard,
  type WhatsAppConnectionSummary,
} from "@/components/admin/whatsapp-connection-card"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { WhatsAppTabs } from "@/components/admin/whatsapp-tabs"
import { SectionCard } from "@/components/admin/section-card"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

interface Conversation {
  phone: string
  name: string | null
  last_text: string | null
  last_is_template?: boolean
  last_direction: string
  last_status: string
  last_at: string | null
  order_number: string | null
  order_status: string | null
  order_total: string | number | null
  order_url: string | null
  order_count: number
}

interface FailedMessage {
  id: number
  status: string
  created_at: string | null
  recipient: string
  order_number: string | null
  order_url: string | null
  message: string | null
  error: string | null
}

interface Props {
  title: string
  description: string
  stats: {
    inbound: number
    outbound: number
    failed: number
    active_templates: number
  }
  failed_count: number
  failed_messages: FailedMessage[]
  range: string
  range_label: string
  range_options: { value: string; label: string }[]
  connection: WhatsAppConnectionSummary
  conversations: Conversation[]
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  )
}

export default function WhatsAppHub({ title, description, stats, connection, conversations, range, range_label, range_options, failed_count, failed_messages }: Props) {
  const page = usePage<SharedPageProps>()

  // Panel pesan gagal tampil bila admin datang dari kartu dashboard
  // (`status=failed`) atau memang ada pesan gagal sepanjang waktu.
  const failedFilterActive =
    new URLSearchParams(page.url.split("?")[1] ?? "").get("status") === "failed"
  const showFailedMessages = failedFilterActive || failed_count > 0

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-xs"
            role="group"
            aria-label="Rentang waktu ringkasan"
          >
            {range_options.map((option) => (
              <Link
                key={option.value}
                href={routeUrl("admin.whatsapp.dashboard", { range: option.value })}
                preserveScroll
                className={
                  option.value === range
                    ? "rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-background shadow-xs"
                    : "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                }
              >
                {option.label}
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              router.reload({
                only: ["stats", "conversations", "connection", "failed_count", "failed_messages"],
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40"
          >
            <Icon name="refresh" className="size-3.5" aria-hidden="true" />
            Muat ulang
          </button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <WhatsAppTabs active="hub" />

      <div className="space-y-5">
      {/* Status sambungan WhatsApp (owner 2026-09-17): terbaca jelas di ringkasan */}
      <WhatsAppConnectionCard connection={connection} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={`Pesan Masuk (${range_label})`} value={stats.inbound} />
        <Metric label={`Pesan Terkirim (${range_label})`} value={stats.outbound} />
        <Metric
          label={`Gagal Terkirim (${range_label})`}
          value={stats.failed}
          tone={stats.failed > 0 ? "text-destructive" : "text-foreground"}
        />
        <Metric label="Template Aktif" value={stats.active_templates} />
      </div>

      {showFailedMessages ? (
        <SectionCard
          title="Pesan Gagal"
          icon="alert-circle"
          description={`Pesan WhatsApp yang gagal terkirim sepanjang waktu, terbaru lebih dulu. Angka ini tidak dibatasi rentang ${range_label.toLowerCase()}.`}
          contentClassName="p-0"
          action={
            <span className="tabular-nums rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive">
              {formatNumber(failed_count)} pesan
            </span>
          }
        >
          {failed_messages.length === 0 ? (
            <EmptyState
              icon="check-circle"
              className="min-h-32 rounded-none border-0 bg-transparent py-8"
              title="Tidak ada pesan WhatsApp yang gagal."
              description="Seluruh pesan otomatis terkirim normal sepanjang riwayat."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-medium text-muted-foreground">
                      <th className="px-5 py-2.5">Waktu</th>
                      <th className="px-3 py-2.5">Penerima</th>
                      <th className="px-3 py-2.5 text-center">Pesanan</th>
                      <th className="px-3 py-2.5">Pesan</th>
                      <th className="px-5 py-2.5">Alasan Gagal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failed_messages.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 last:border-0 align-top">
                        <td className="whitespace-nowrap px-5 py-3 text-[11px] text-muted-foreground">
                          {row.created_at ?? "-"}
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-mono text-[11px] text-foreground">{row.recipient}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row.order_number ? (
                            row.order_url ? (
                              <Link
                                href={row.order_url}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              >
                                {row.order_number}
                                <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
                              </Link>
                            ) : (
                              <span className="text-xs font-medium text-foreground">{row.order_number}</span>
                            )
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Tanpa pesanan</span>
                          )}
                        </td>
                        <td className="max-w-[320px] px-3 py-3">
                          <p className="line-clamp-2 text-xs text-foreground">
                            {row.message ?? "Pesan tanpa teks"}
                          </p>
                        </td>
                        <td className="max-w-[280px] px-5 py-3">
                          {row.error ? (
                            <p className="line-clamp-2 text-[11px] text-destructive">{row.error}</p>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Alasan tidak tercatat</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {failed_count > failed_messages.length ? (
                <p className="border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
                  Menampilkan {failed_messages.length} terbaru dari {formatNumber(failed_count)} pesan gagal.
                </p>
              ) : null}
            </>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Percakapan Terakhir"
        description={`Pesan terbaru tiap pelanggan beserta pesanan terkininya, rentang ${range_label.toLowerCase()}.`}
        contentClassName="p-0"
      >
        {conversations.length === 0 ? (
          <p className="p-5 text-xs text-muted-foreground">Belum ada percakapan pada rentang {range_label.toLowerCase()}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="border-b border-border text-[11px] font-medium text-muted-foreground">
                  <th className="px-5 py-2.5">Pelanggan</th>
                  <th className="px-3 py-2.5">Pesan Terakhir</th>
                  <th className="px-3 py-2.5 text-center">Waktu</th>
                  <th className="px-3 py-2.5 text-center">Pesanan Terkini</th>
                  <th className="px-3 py-2.5 text-center">Status Pesanan</th>
                  <th className="px-5 py-2.5 text-right">Buka</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((row) => (
                  <tr key={row.phone} className="border-b border-border/60 last:border-0 align-top">
                    <td className="px-5 py-3">
                      <p className="text-xs font-medium text-foreground">{row.name ?? "Nomor belum terdaftar"}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{row.phone}</p>
                      {row.order_count > 1 ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{row.order_count} pesanan</p>
                      ) : null}
                    </td>
                    <td className="max-w-[320px] px-3 py-3">
                      <p className="flex items-start gap-1.5 text-xs text-foreground">
                        <Icon
                          name={row.last_direction === "inbound" ? "arrow-down-left" : "arrow-up-right"}
                          className={`mt-0.5 size-3.5 shrink-0 ${row.last_direction === "inbound" ? "text-info" : "text-muted-foreground"}`}
                          aria-hidden="true"
                        />
                        {row.last_is_template ? (
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Otomatis
                            </span>
                            <span className="truncate font-medium text-foreground">{row.last_text}</span>
                          </span>
                        ) : (
                          <span className="line-clamp-2">{row.last_text ?? "Pesan tanpa teks"}</span>
                        )}
                      </p>
                      {row.last_status === "failed" ? (
                        <p className="mt-1 text-[11px] font-medium text-destructive">Gagal terkirim</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-center text-[11px] text-muted-foreground">{row.last_at ?? "-"}</td>
                    <td className="px-3 py-3 text-center">
                      {row.order_number ? (
                        <>
                          <p className="text-xs font-medium text-foreground">{row.order_number}</p>
                          {row.order_total ? (
                            <p className="text-[11px] tabular-nums text-muted-foreground">
                              {formatCurrency(Number(row.order_total))}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {row.order_status ? <StatusBadge status={row.order_status} /> : <span className="text-[11px] text-muted-foreground">-</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {row.order_url ? (
                        <Link
                          href={row.order_url}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Detail
                          <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Tanpa pesanan</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      </div>
    </AdminLayout>
  )
}
