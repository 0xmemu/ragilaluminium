import { Head, Link } from "@inertiajs/react"
import { useEffect, useState } from "react"

import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/admin/ui/alert"
import { Button } from "@/components/admin/ui/button"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"

interface Props {
  title: string
  description: string
  backUrl: string
  statusUrl: string
  qrUrl: string
  codeUrl: string
  refreshQrUrl: string
  provider: string
  flash: { success: string | null; error: string | null; code: string | null }
}

export default function Pairing({
  title,
  description,
  backUrl,
  statusUrl,
  qrUrl,
  codeUrl,
  refreshQrUrl,
  provider,
  flash,
}: Props) {
  const [status, setStatus] = useState<string>("connecting")
  const [statusText, setStatusText] = useState<string>("Menghubungkan...")
  const [qrTs, setQrTs] = useState<number>(Date.now())
  const [hasSession, setHasSession] = useState<boolean>(false)
  const [connectedPhone, setConnectedPhone] = useState<string>("")
  const [sessionName, setSessionName] = useState<string>("")
  const [phone, setPhone] = useState<string>("")

  useEffect(() => {
    let active = true
    const poll = () => {
      fetch(statusUrl, { headers: { Accept: "application/json" } })
        .then((r) => r.json())
        .then((d) => {
          if (!active) return
          setStatus(d.status)
          setStatusText(d.statusText)
          if (typeof d.has_session === "boolean") setHasSession(d.has_session)
          if (d.connected_phone) setConnectedPhone(d.connected_phone)
          if (d.session_name) setSessionName(d.session_name)
          if (d.status === "SCAN_QR" && !d.has_session) setQrTs(Date.now())
        })
        .catch(() => {})
    }
    poll()
    const t = setInterval(poll, 3000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [statusUrl])

  const connected = status === "open"
  const reconnectingSession = hasSession && !connected
  const showQr = !hasSession && (status === "SCAN_QR" || status === "connecting")

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={<StatusBadge status={connected ? "success" : status === "SCAN_QR" ? "warning" : "info"} />}
    >
      <Head title={`${title} | Admin`} />

      <div className="mb-4">
        <Button asChild variant="secondary">
          <Link href={backUrl}>
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />
            Kembali ke Hubungkan WhatsApp
          </Link>
        </Button>
      </div>

      {flash.success && (
        <Alert tone="success">
          <p className="text-sm">{flash.success}</p>
        </Alert>
      )}
      {flash.error && (
        <Alert tone="danger">
          <p className="text-sm">{flash.error}</p>
        </Alert>
      )}

      {connected && (
        <Alert tone="success">
          <p className="font-bold">Sesi aktif — terhubung</p>
          <p className="text-sm">
            Nomor terhubung: <b>{connectedPhone || "—"}</b>
            {sessionName ? ` (${sessionName})` : ""}. Pesan automasi terkirim lewat provider <b>{provider?.toUpperCase()}</b>.
          </p>
        </Alert>
      )}

      {reconnectingSession && (
        <Alert tone="warning">
          <p className="font-bold">Sesi terdeteksi — mencoba menghubungkan kembali</p>
          <p className="text-sm">
            Nomor: <b>{connectedPhone || "—"}</b>. Gateway sedang mencoba memulihkan koneksi{" "}
            <b>{statusText}</b>. QR tidak perlu di-scan ulang.
          </p>
        </Alert>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Icon name="qr" className="size-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-bold">Scan QR</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Buka WhatsApp di HP → <b>Menu</b> → <b>Perangkat Tertaut</b> → <b>Tautkan Perangkat</b>, lalu scan QR di bawah.
          </p>
          <div className="flex justify-center rounded-md border border-border bg-background p-4">
            {showQr ? (
              <img src={`${qrUrl}?t=${qrTs}`} alt="WhatsApp QR" className="max-h-[340px] w-auto" />
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {hasSession ? (
                  <>
                    <Icon name="check" className="mx-auto mb-2 size-8 text-success" aria-hidden="true" />
                    Perangkat sudah tertaut.
                    <br />
                    Nomor: <b>{connectedPhone || "—"}</b>
                  </>
                ) : (
                  <>
                    QR belum tersedia.
                    <br />
                    Status gateway: <b>{statusText}</b>
                  </>
                )}
              </div>
            )}
          </div>
          {showQr && (
            <form method="post" action={refreshQrUrl} className="mt-2">
              <Button type="submit" className="w-full">
                <Icon name="refresh" className="size-4" aria-hidden="true" />
                Generate QR Baru
              </Button>
            </form>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Icon name="phone" className="size-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-bold">Pairing Code (tanpa scan)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Alternatif jika QR tidak muncul: di HP pilih <b>"Tautkan dengan nomor telepon"</b>, lalu masukkan kode 8 digit di bawah.
          </p>
          <form method="post" action={codeUrl} className="flex gap-2">
            <input
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nomor, contoh 62817xxxxxxx"
              inputMode="tel"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button type="submit" disabled={!phone.trim()}>
              Dapatkan Kode
            </Button>
          </form>

          {flash.code && (
            <Alert tone="success">
              <p className="text-sm font-bold">Pairing Code:</p>
              <p className="text-2xl font-bold tracking-[0.3em]">{flash.code}</p>
              <p className="text-xs text-muted-foreground">Segera masukkan di HP sebelum kedaluwarsa.</p>
            </Alert>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
