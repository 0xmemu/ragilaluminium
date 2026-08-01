import { Head, Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/admin/ui/alert"
import { Button } from "@/components/admin/ui/button"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { formatDate } from "@/lib/format"

interface ConnectionInfo {
  configured: boolean
  default_provider: string
  compare_provider: string | null
  compare_allowlist: string[]
  webhook_path: string
  waha_webhook_path: string
  providers: {
    meta: {
      configured: boolean
      base_url?: string | null
      token_set: boolean
      number_id_set?: boolean
      verify_token_set?: boolean
    }
    waha: {
      configured: boolean
      base_url?: string | null
      token_set: boolean
      session?: string | null
      api_key_set?: boolean
      webhook_secret_set?: boolean
    }
  }
}

interface ConnectionStats {
  sent_count: number
  failed_count: number
  last_sent_at: string | null
}

export default function WhatsAppConnection({
  title,
  description,
  backUrl,
  connection,
  stats,
}: {
  title: string
  description: string
  backUrl: string
  connection: ConnectionInfo
  stats: ConnectionStats
}) {
  return (
    <AdminLayout
      title={title}
      description={description}
      actions={<StatusBadge status={connection.configured ? "active" : "inactive"} />}
    >
      <Head title={`${title} | Admin`} />

      <div className="mb-4">
        <Button asChild variant="secondary">
          <Link href={backUrl}>
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />
            Kembali ke WhatsApp Otomatis
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-md border border-border bg-muted/40 text-primary">
              <Icon name="whatsapp" className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold">
                {connection.configured ? "Provider aktif siap dipakai" : "Provider aktif belum dikonfigurasi"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Meta resmi dan WAHA bisa hidup berdampingan. Compare mode dibatasi ke nomor allowlist supaya order nyata tidak menerima pesan ganda.
              </p>
            </div>
          </div>

          <Alert tone={connection.configured ? "info" : "warning"}>
            {connection.configured
              ? `Provider aktif: ${connection.default_provider.toUpperCase()}${connection.compare_provider ? ` · Compare: ${connection.compare_provider.toUpperCase()}` : ""}`
              : "Set provider aktif di .env. Jika provider aktif belum siap, aplikasi tetap degradasi dengan pencatatan pesan untuk dev/test."}
          </Alert>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold">Meta resmi</h3>
                <StatusBadge status={connection.providers.meta.configured ? "active" : "inactive"} />
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">API token</dt>
                  <dd className="font-semibold">{connection.providers.meta.token_set ? "Terisi" : "Kosong"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Phone number ID</dt>
                  <dd className="font-semibold">{connection.providers.meta.number_id_set ? "Terisi" : "Kosong"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Verify token</dt>
                  <dd className="font-semibold">{connection.providers.meta.verify_token_set ? "Terisi" : "Kosong"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Webhook</dt>
                  <dd className="font-mono text-xs font-semibold">{connection.webhook_path}</dd>
                </div>
                {connection.providers.meta.base_url ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Base URL</dt>
                    <dd className="max-w-[60%] truncate font-mono text-xs">{connection.providers.meta.base_url}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="rounded-md border border-border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold">WAHA</h3>
                <StatusBadge status={connection.providers.waha.configured ? "active" : "inactive"} />
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">API key</dt>
                  <dd className="font-semibold">{connection.providers.waha.api_key_set ? "Terisi" : "Kosong"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Session</dt>
                  <dd className="font-mono text-xs font-semibold">{connection.providers.waha.session ?? "default"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Webhook secret</dt>
                  <dd className="font-semibold">{connection.providers.waha.webhook_secret_set ? "Terisi" : "Kosong"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Webhook</dt>
                  <dd className="font-mono text-xs font-semibold">{connection.waha_webhook_path}</dd>
                </div>
                {connection.providers.waha.base_url ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Base URL</dt>
                    <dd className="max-w-[60%] truncate font-mono text-xs">{connection.providers.waha.base_url}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>

          <dl className="space-y-3 text-sm border-t border-border pt-4">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Provider aktif</dt>
              <dd className="font-semibold uppercase">{connection.default_provider}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Compare provider</dt>
              <dd className="font-semibold uppercase">{connection.compare_provider ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Allowlist compare</dt>
              <dd className="max-w-[60%] text-right font-mono text-xs">
                {connection.compare_allowlist.length > 0 ? connection.compare_allowlist.join(", ") : "Belum ada"}
              </dd>
            </div>
          </dl>

          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-bold text-foreground">Cara dapat token dari Meta</h3>
            <p className="text-sm text-muted-foreground">
              Tidak ada QR. Token sementara di API Setup (~24 jam) hanya untuk tes{" "}
              <code className="text-xs">hello_world</code>. Production memakai{" "}
              <strong className="font-semibold text-foreground">System User token permanen</strong>.
              Jangan tukar Phone Number ID dengan WABA ID. Panduan lengkap:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                skills/stage-8-whatsapp-business-integration.md
              </code>{" "}
              §2.3 dan{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">docs/whatsapp-production-setup.md</code>.
            </p>
            <ol className="list-decimal space-y-2.5 pl-5 text-sm text-muted-foreground">
              <li>
                Di{" "}
                <a
                  href="https://developers.facebook.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  developers.facebook.com
                </a>{" "}
                → App WhatsApp → API Setup: salin{" "}
                <strong className="text-foreground">Phone number ID</strong> →{" "}
                <code className="text-xs">WHATSAPP_BUSINESS_NUMBER_ID</code>.
              </li>
              <li>
                <a
                  href="https://business.facebook.com/settings"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Business Settings
                </a>{" "}
                → Users → System users → Add (Admin) → Assign assets (App + WABA) → Generate token
                (Never) dengan <code className="text-xs">whatsapp_business_messaging</code> +{" "}
                <code className="text-xs">whatsapp_business_management</code> →{" "}
                <code className="text-xs">WHATSAPP_API_TOKEN</code>.
              </li>
              <li>
                Buat string acak untuk <code className="text-xs">WHATSAPP_VERIFY_TOKEN</code>. Webhook
                Meta (<code className="text-xs">{connection.webhook_path}</code>) pakai token yang sama —
                butuh URL HTTPS publik; lokal: tunnel.{" "}
                <strong className="font-semibold text-foreground">Boleh ditunda</strong> — kirim
                notifikasi order tidak menunggu webhook.
              </li>
              <li>
                Ajukan template transactional di{" "}
                <a
                  href="https://business.facebook.com/wa/manage/home/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  WhatsApp Manager
                </a>
                , lalu petakan nama provider di WhatsApp Otomatis → Edit (
                <code className="text-xs">order_created_cod</code>,{" "}
                <code className="text-xs">payment_instructions</code>, …).
              </li>
            </ol>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-bold text-foreground">Langkah produksi (nomor nyata)</h3>
            <p className="text-sm text-muted-foreground">
              Lewati nomor uji Meta (+1 555…) jika pesan tidak muncul di HP. Ganti ke nomor bisnis +
              payment method, lalu update Phone Number ID dan token permanen di{" "}
              <code className="text-xs">.env</code>.
            </p>
            <ol className="list-decimal space-y-2.5 pl-5 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://business.facebook.com/wa/manage/phone-numbers/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Phone numbers
                </a>
                : daftar nomor bisnis + pembayaran Meta.
              </li>
              <li>
                Template body <code className="text-xs">{"{{1}} {{2}} {{3}}"}</code> = nomor order,
                item, total (bahasa <code className="text-xs">id</code>).
              </li>
              <li>Uji checkout toko → chat dari nomor bisnis (bukan +1 555).</li>
            </ol>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-bold text-foreground">Mode banding langsung</h3>
            <p className="text-sm text-muted-foreground">
              Gunakan <code className="text-xs">WHATSAPP_PROVIDER</code> untuk provider aktif dan{" "}
              <code className="text-xs">WHATSAPP_COMPARE_PROVIDER</code> untuk provider pembanding.
              Batasi pengiriman ganda ke nomor uji melalui{" "}
              <code className="text-xs">WHATSAPP_COMPARE_ALLOWLIST</code>.
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-bold">Perangkat & trafik</h2>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">
                Status koneksi
              </dt>
              <dd className="mt-1 text-lg font-bold">
                {connection.configured ? "Siap kirim" : "Mode degradasi / belum siap"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">
                Total pesan terkirim
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{stats.sent_count}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">
                Gagal
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{stats.failed_count}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">
                Pengiriman terakhir
              </dt>
              <dd className="mt-1 font-semibold">
                {stats.last_sent_at ? formatDate(stats.last_sent_at) : "Belum ada"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </AdminLayout>
  )
}
