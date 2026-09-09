import { Head, Link } from "@inertiajs/react"
import * as React from "react"
import { useState, type FormEvent } from "react"

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
  const [status, setStatus] = useState<string>("unknown")
  const [statusText, setStatusText] = useState<string>("Status belum dimuat")
  const [qrTs, setQrTs] = useState<number>(0)
  const [hasSession, setHasSession] = useState<boolean>(false)
  const [connectedPhone, setConnectedPhone] = useState<string>("")
  const [sessionName, setSessionName] = useState<string>("")
  const [phone, setPhone] = useState<string>("")
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [qrError, setQrError] = useState<boolean>(false)

  // Manual refresh eksplisit - TANPA polling/setInterval (Design Contract D).
  function refreshStatus() {
    setRefreshing(true)
    fetch(statusUrl, { headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.status)
        setStatusText(d.statusText)
        if (typeof d.has_session === "boolean") setHasSession(d.has_session)
        if (d.connected_phone) setConnectedPhone(d.connected_phone)
        if (d.session_name) setSessionName(d.session_name)
        if (d.status === "SCAN_QR" && !d.has_session) {
          setQrTs(Date.now())
          setQrError(false)
        }
      })
      .catch(() => {})
      .finally(() => setRefreshing(false))
  }

  React.useEffect(() => {
    refreshStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusUrl])

  const connected = status === "open"
  const unreachable = status === "unreachable"
  const reconnectingSession = hasSession && !connected
  const showQr = !hasSession && (status === "SCAN_QR" || status === "connecting")

  const healthLabel = connected
    ? "Sehat"
    : unreachable
      ? "Gagal atau Offline"
      : hasSession
        ? "Perlu Perhatian"
        : "Belum Dikonfigurasi"
  const healthTone = connected ? "success" : unreachable ? "danger" : hasSession ? "warning" : "neutral"

  const generateLabel = connected
    ? "Generate QR Baru"
    : showQr
      ? "Generate Ulang QR"
      : "Generate QR & Mulai Pairing"

  const confirmRefreshQr = (e: FormEvent) => {
    e.preventDefault()
    const msg = connected
      ? `Sesi WhatsApp saat ini terhubung ke ${connectedPhone || "nomor yang aktif"}.\n\nGenerate QR baru akan memutus sesi ini dan menampilkan QR pengganti untuk di-scan ulang. Lanjutkan?`
      : `Generate QR baru untuk di-scan? Sesi/pairing saat ini akan diganti dengan QR baru.\n\nLanjutkan?`
    if (window.confirm(msg)) {
      ;(e.target as HTMLFormElement).submit()
    }
  }

  const confirmPairingCode = (e: FormEvent) => {
    e.preventDefault()
    const target = e.target as HTMLFormElement
    const msg = `Dapatkan pairing code untuk nomor ${phone.trim()}?\n\nPastikan nomor itu adalah yang benar di HP sebelum melanjutkan.`
    if (window.confirm(msg)) {
      target.submit()
    }
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge status={healthTone} label={healthLabel} />
          <Button type="button" variant="ghost" size="sm" onClick={refreshStatus} disabled={refreshing}>
            <Icon name="refresh" className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
            {refreshing ? "Memuat..." : "Refresh"}
          </Button>
        </div>
      }
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
          <p className="font-bold">Sesi aktif - terhubung</p>
          <p className="text-sm">
            Nomor terhubung: <b>{connectedPhone || "-"}</b>
            {sessionName ? ` (${sessionName})` : ""}. Pesan automasi terkirim lewat provider <b>{provider?.toUpperCase()}</b>.
          </p>
        </Alert>
      )}

      {reconnectingSession && (
        <Alert tone="warning">
          <p className="font-bold">Sesi terdeteksi - mencoba menghubungkan kembali</p>
          <p className="text-sm">
            Nomor: <b>{connectedPhone || "-"}</b>. Gateway sedang mencoba memulihkan koneksi{" "}
            <b>{statusText}</b>. QR tidak perlu di-scan ulang.
          </p>
        </Alert>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Icon name="qr" className="size-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-bold">Scan QR</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Buka WhatsApp di HP → <b>Menu</b> → <b>Perangkat Tertaut</b> → <b>Tautkan Perangkat</b>, lalu scan QR di bawah.
          </p>
          <div className="flex justify-center rounded-md border border-border bg-background p-4">
            {showQr && !qrError ? (
              <img src={`${qrUrl}?t=${qrTs}`} alt="WhatsApp QR" className="max-h-[340px] w-auto" onError={() => setQrError(true)} />
            ) : hasSession ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Icon name="check" className="mx-auto mb-2 size-8 text-success" aria-hidden="true" />
                Perangkat sudah tertaut.
                <br />
                Nomor: <b>{connectedPhone || "-"}</b>
              </div>
            ) : unreachable ? (
              <div className="py-10 text-center text-sm text-destructive">
                <Icon name="alert-triangle" className="mx-auto mb-2 size-8" aria-hidden="true" />
                Gateway tidak dapat dijangkau.
                <br />
                Cek service Baileys.
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                QR belum tersedia.
                <br />
                Status gateway: <b>{statusText}</b>
                <div className="mt-3 flex justify-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={refreshStatus} disabled={refreshing}>
                    <Icon name="refresh" className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
                    {refreshing ? "Memuat..." : "Coba Lagi"}
                  </Button>
                  <form method="post" action={refreshQrUrl} onSubmit={confirmRefreshQr}>
                    <Button type="submit" size="sm">
                      <Icon name="qr" className="size-4" aria-hidden="true" />
                      Generate QR
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </div>
          <form method="post" action={refreshQrUrl} className="mt-2" onSubmit={confirmRefreshQr}>
            <Button type="submit" className="w-full" disabled={unreachable}>
              <Icon name="refresh" className="size-4" aria-hidden="true" />
              {generateLabel}
            </Button>
          </form>
          {unreachable ? (
            <p className="mt-1 text-center text-xs text-destructive">Gateway tidak dapat dijangkau. Cek service Baileys.</p>
          ) : null}
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Icon name="phone" className="size-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-bold">Pairing Code (tanpa scan)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Alternatif jika QR tidak muncul: di HP pilih <b>"Tautkan dengan nomor telepon"</b>, lalu masukkan kode 8 digit di bawah.
          </p>
          <form method="post" action={codeUrl} className="flex gap-2" onSubmit={confirmPairingCode}>
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