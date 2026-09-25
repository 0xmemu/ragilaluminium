import { Head } from "@inertiajs/react"
import * as React from "react"
import { useState, type FormEvent } from "react"

import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/admin/ui/alert"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Card } from "@/components/ui/card"
import { WhatsAppTabs } from "@/components/admin/whatsapp-tabs"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"

interface Props {
  title: string
  description: string
  stats?: { sent: number; failed: number; total: number }
  statusUrl: string
  qrUrl: string
  codeUrl: string
  refreshQrUrl: string
  disconnectUrl?: string
  provider: string
  flash: { success: string | null; error: string | null; code: string | null }
}

function formatPhoneDisplay(raw: string): string {
  if (!raw) return "-"
  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("62") && digits.length >= 10) {
    const local = digits.slice(2)
    const p1 = local.slice(0, 3)
    const p2 = local.slice(3, 7)
    const p3 = local.slice(7)
    return `+62 ${p1}-${p2}${p3 ? `-${p3}` : ""}`
  }
  return raw
}

export default function Pairing({
  title,
  description,
  stats,
  statusUrl,
  qrUrl,
  codeUrl,
  refreshQrUrl,
  disconnectUrl = routeUrl("admin.whatsapp.pairing.disconnect"),
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
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<boolean>(false)
  const [justConnected, setJustConnected] = useState<boolean>(false)
  const [pairingNotice, setPairingNotice] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<boolean>(false)

  const wasLinkedRef = React.useRef<boolean>(false)

  const fetchStatus = React.useCallback((): void => {
    fetch(statusUrl, { headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.status)
        setStatusText(d.statusText)
        if (typeof d.has_session === "boolean") setHasSession(d.has_session)
        const resolvedPhone = d.connected_phone || d.phone || ""
        if (resolvedPhone) setConnectedPhone(resolvedPhone.replace(/[:@].*$/, ""))
        if (d.session_name) setSessionName(d.session_name)
        if (d.status === "SCAN_QR" && !d.has_session) {
          setQrTs(Date.now())
          setQrError(false)
        }

        // Perangkat baru saja tersambung: tampilkan konfirmasi sukses dan
        // bersihkan instruksi pairing yang sudah tidak relevan.
        const nowLinked = d.status === "open"
        if (nowLinked && !wasLinkedRef.current) {
          setJustConnected(true)
          setPairingNotice(null)
        }
        if (!nowLinked && wasLinkedRef.current) {
          setJustConnected(false)
        }
        wasLinkedRef.current = nowLinked
      })
      .catch(() => {})
      .finally(() => setRefreshing(false))
  }, [statusUrl])

  function handleManualRefresh(): void {
    setRefreshing(true)
    fetchStatus()
  }

  React.useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Live sync status tanpa memuat ulang halaman.
  // Hanya membaca status (GET), tidak pernah memutus atau mengganti sesi.
  // Berhenti otomatis begitu perangkat tersambung.
  React.useEffect(() => {
    if (status === "open") return

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchStatus()
      }
    }, 4000)

    return () => window.clearInterval(timer)
  }, [status, fetchStatus])

  const connected = status === "open"
  const unreachable = status === "unreachable"
  const hasLinkedDevice = connected || Boolean(connectedPhone && hasSession)
  const refreshQrFormRef = React.useRef<HTMLFormElement>(null)
  const resetFormRef = React.useRef<HTMLFormElement>(null)
  const pairingCodeFormRef = React.useRef<HTMLFormElement>(null)
  const reconnectingSession = hasSession && !connected
  const showQr = !hasLinkedDevice && !hasSession && (status === "SCAN_QR" || status === "connecting")

  const healthLabel = connected
    ? "Sehat"
    : unreachable
      ? "Gagal atau Offline"
      : hasSession
        ? "Perlu Perhatian"
        : "Belum Dikonfigurasi"
  const healthTone = connected ? "success" : unreachable ? "danger" : hasSession ? "warning" : "neutral"

  const generateLabel = showQr ? "Generate Ulang QR" : "Generate QR & Mulai Pairing"



  const handleDisconnectSubmit = (e: FormEvent): void => {
    e.preventDefault()
    setDisconnecting(true)
    ;(e.target as HTMLFormElement).submit()
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge status={healthTone} label={healthLabel} />
          <Button type="button" variant="ghost" size="sm" onClick={handleManualRefresh} disabled={refreshing}>
            <Icon name="refresh" className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
            {refreshing ? "Memuat..." : "Refresh"}
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <WhatsAppTabs active="pairing" />

      {justConnected ? (
        <Alert tone="success" className="mb-4">
          <p className="text-sm font-semibold">
            Nomor WhatsApp berhasil tersambung. Panel siap mengirim dan menerima pesan.
          </p>
        </Alert>
      ) : null}

      {/* Instruksi pairing hanya relevan selama belum tersambung. */}
      {!hasLinkedDevice && (pairingNotice ?? flash.success) ? (
        <Alert tone="success" className="mb-4">
          <p className="text-sm">{pairingNotice ?? flash.success}</p>
        </Alert>
      ) : null}
      {!hasLinkedDevice && flash.error ? (
        <Alert tone="danger" className="mb-4">
          <p className="text-sm">{flash.error}</p>
        </Alert>
      ) : null}

      {/* =================================================================== */}
      {/* KONDISI 1: ADA NOMOR YANG TERHUBUNG (KARTU PAIRING DISEMBUNYIKAN)   */}
      {/* =================================================================== */}
      {hasLinkedDevice ? (
        <div className="space-y-6">
          {/* Kartu Utama Perangkat Terhubung */}
          <Card className="border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                {/* Avatar Icon WhatsApp Terhubung */}
                <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs">
                  <Icon name="whatsapp" className="size-8" />
                  <span className="absolute -bottom-1 -right-1 flex size-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-4 rounded-full bg-emerald-500 ring-2 ring-card" />
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">
                      WhatsApp Terhubung & Aktif
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <Icon name="check" className="size-3" />
                      <span>Online</span>
                    </span>
                  </div>

                  <p className="font-mono text-xl font-bold tracking-tight text-foreground">
                    {formatPhoneDisplay(connectedPhone)}
                  </p>

                  {sessionName ? (
                    <p className="text-xs text-muted-foreground">
                      Nama Akun: <span className="font-semibold text-foreground">{sessionName}</span>
                    </p>
                  ) : null}

                  <p className="pt-1 text-xs leading-relaxed text-muted-foreground max-w-xl">
                    Gateway WhatsApp aktif dan siap mengirim serta menerima pesan pelanggan.
                  </p>
                </div>
              </div>

              {/* Tombol Aksi Cepat */}
              <div className="flex shrink-0 flex-wrap gap-2 pt-2 sm:pt-0">
                <Button type="button" variant="secondary" size="sm" onClick={handleManualRefresh} disabled={refreshing}>
                  <Icon name="refresh" className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
                  <span>Cek Status</span>
                </Button>
              </div>
            </div>

            {/* Banner Proteksi Sesi */}
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
              <Icon name="shield-check" className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <span className="font-semibold block">Sesi Terlindungi</span>
                <span className="text-muted-foreground mt-0.5 block">
                  Kartu scan QR dan formulir pairing code disembunyikan untuk menjaga sambungan tetap aman dan mencegah pembuatan QR baru yang dapat memutus hubungan nomor aktif ini.
                </span>
              </div>
            </div>

            {/* Zona Pemutusan Sambungan (Jika ingin ganti nomor) */}
            <div className="mt-8 border-t border-border pt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">Ingin Menghubungkan Nomor Lain?</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Putuskan sambungan nomor saat ini terlebih dahulu jika Anda ingin mengganti nomor WhatsApp toko.
                  </p>
                </div>

                {!showDisconnectConfirm ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDisconnectConfirm(true)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 shrink-0"
                  >
                    <Icon name="sign-out" className="size-3.5" />
                    <span>Putuskan Sambungan</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDisconnectConfirm(false)}
                      disabled={disconnecting}
                    >
                      Batal
                    </Button>
                    <form method="post" action={disconnectUrl} onSubmit={handleDisconnectSubmit}>
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        disabled={disconnecting}
                        className="inline-flex items-center gap-1.5"
                      >
                        {disconnecting ? (
                          <Icon name="refresh" className="size-3.5 animate-spin" />
                        ) : (
                          <Icon name="sign-out" className="size-3.5" />
                        )}
                        <span>{disconnecting ? "Memutuskan..." : "Ya, Putuskan Sesi"}</span>
                      </Button>
                    </form>
                  </div>
                )}
              </div>

              {showDisconnectConfirm ? (
                <div className="mt-3 rounded-md bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20 animate-in fade-in duration-200">
                  <p className="font-semibold">Peringatan:</p>
                  <p className="mt-0.5">
                    Memutuskan sambungan akan menghapus sesi WhatsApp di server. Layanan pesan otomatis pesanan akan terhenti sampai Anda menghubungkan nomor baru melalui scan QR.
                  </p>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : reconnectingSession ? (
        /* =================================================================== */
        /* KONDISI 2: SESI TERDETEKSI TAPI SEDANG MENYAMBUNG ULANG             */
        /* =================================================================== */
        <Card className="border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Icon name="refresh" className="size-6 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">
                Sesi Terdeteksi : Mencoba Menghubungkan Ulang
              </h2>
              <p className="font-mono text-base font-semibold text-foreground">
                {formatPhoneDisplay(connectedPhone)}
              </p>
              <p className="text-xs text-muted-foreground">
                Gateway sedang memulihkan koneksi dengan sesi yang tersimpan ({statusText}). Kartu scan QR disembunyikan karena tidak perlu scan ulang.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleManualRefresh} disabled={refreshing}>
              <Icon name="refresh" className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
              <span>Refresh Status</span>
            </Button>
            <form ref={resetFormRef} method="post" action={disconnectUrl}>
              <ConfirmAction
                trigger={
                  <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                    <span>Reset & Hapus Sesi</span>
                  </Button>
                }
                title="Reset dan hapus sesi WhatsApp?"
                description="Sesi WhatsApp di server akan dihapus, sehingga pengiriman pesan otomatis pesanan berhenti sampai admin melakukan pairing ulang. Tindakan ini tidak bisa dibatalkan."
                confirmLabel="Reset & Hapus Sesi"
                onConfirm={() => resetFormRef.current?.submit()}
              />
            </form>
          </div>
        </Card>
      ) : (
        /* =================================================================== */
        /* KONDISI 3: BELUM TERTAUT : TAMPILKAN KARTU PAIRING (SCAN QR & KODE) */
        /* =================================================================== */
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {/* Card 1: Scan QR */}
          <section className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Icon name="qr" className="size-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-bold">Scan QR</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Buka WhatsApp di HP : <b>Menu</b> : <b>Perangkat Tertaut</b> : <b>Tautkan Perangkat</b>, lalu scan QR di bawah.
            </p>
            <div className="flex justify-center rounded-md border border-border bg-background p-4">
              {showQr && !qrError ? (
                <img src={`${qrUrl}?t=${qrTs}`} alt="WhatsApp QR" className="max-h-[340px] w-auto" onError={() => setQrError(true)} />
              ) : unreachable ? (
                <div className="py-10 text-center text-sm text-destructive">
                  <Icon name="alert-triangle" className="mx-auto mb-2 size-8" aria-hidden="true" />
                  Gateway tidak dapat dijangkau.
                  <br />
                  Cek service WhatsApp gateway di server.
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  QR belum tersedia.
                  <br />
                  Status gateway: <b>{statusText}</b>
                  <br />
                  Tekan tombol Generate QR di bawah untuk memulai pairing.
                </div>
              )}
            </div>

            <form ref={refreshQrFormRef} method="post" action={refreshQrUrl} className="mt-2">
              <ConfirmAction
                trigger={
                  <Button type="button" className="w-full" disabled={unreachable}>
                    <Icon name="refresh" className="size-4" aria-hidden="true" />
                    <span>{generateLabel}</span>
                  </Button>
                }
                title="Generate QR baru?"
                description="QR baru akan mengganti sesi atau pairing yang sedang berjalan. Lanjutkan hanya bila memang ingin pairing ulang."
                confirmLabel="Generate QR"
                variant="primary"
                onConfirm={() => refreshQrFormRef.current?.submit()}
              />
            </form>

            {unreachable ? (
              <p className="mt-1 text-center text-xs text-destructive">
                Gateway tidak dapat dijangkau. Cek service WhatsApp gateway di server.
              </p>
            ) : null}
          </section>

          {/* Card 2: Pairing Code (tanpa scan) */}
          <section className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Icon name="phone" className="size-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-bold">Pairing Code (tanpa scan)</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Alternatif jika kamera HP bermasalah: di HP pilih <b>"Tautkan dengan nomor telepon"</b>, lalu masukkan kode 8 digit di bawah.
            </p>
            <form ref={pairingCodeFormRef} method="post" action={codeUrl} className="flex gap-2">
              <input
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nomor, contoh 62817xxxxxxx"
                inputMode="tel"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <ConfirmAction
                trigger={
                  <Button type="button" disabled={!phone.trim()}>
                    Dapatkan Kode
                  </Button>
                }
                title={`Dapatkan pairing code untuk ${phone.trim()}?`}
                description="Pastikan nomor itu memang nomor WhatsApp yang benar di HP. Kode hanya berlaku sekali dan segera kedaluwarsa."
                confirmLabel="Dapatkan Kode"
                variant="primary"
                onConfirm={() => pairingCodeFormRef.current?.submit()}
              />
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
      )}
      {stats ? (
        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">Pesan Terkirim</p>
            <p className="mt-1 text-xl font-bold text-foreground">{stats.sent.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">Pesan Gagal</p>
            <p className="mt-1 text-xl font-bold text-foreground">{stats.failed.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">Total Lalu Lintas Pesan</p>
            <p className="mt-1 text-xl font-bold text-foreground">{stats.total.toLocaleString("id-ID")}</p>
          </div>
        </section>
      ) : null}
    </AdminLayout>
  )
}
