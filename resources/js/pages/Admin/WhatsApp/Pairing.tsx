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
  provider: string
}

export default function Pairing({ title, description, backUrl, statusUrl, qrUrl, codeUrl, provider }: Props) {
  const [status, setStatus] = useState<string>("connecting")
  const [statusText, setStatusText] = useState<string>("Menghubungkan...")
  const [qrTs, setQrTs] = useState<number>(Date.now())
  const [phone, setPhone] = useState<string>("")
  const [code, setCode] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    const poll = () => {
      fetch(statusUrl, { headers: { Accept: "application/json" } })
        .then((r) => r.json())
        .then((d) => {
          if (!active) return
          setStatus(d.status)
          setStatusText(d.statusText)
          if (d.status === "SCAN_QR") setQrTs(Date.now())
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

  const requestCode = () => {
    if (!phone.trim()) {
      setError("Masukkan nomor WhatsApp terlebih dahulu.")
      return
    }
    setLoading(true)
    setError("")
    setCode("")
    fetch(codeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json",
      },
      body: JSON.stringify({ phone }),
    })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Gagal membuat pairing code.")
        setCode(d.code)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  const connected = status === "open"

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

      {connected && (
        <Alert tone="success">
          Gateway sudah terhubung ke nomor aktif. Pesan automasi akan terkirim lewat provider <b>{provider?.toUpperCase()}</b>.
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
            {!connected ? (
              <img src={`${qrUrl}?t=${qrTs}`} alt="WhatsApp QR" className="max-h-[340px] w-auto" />
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                QR belum tersedia.
                <br />
                Status gateway: <b>{statusText}</b>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Icon name="phone" className="size-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-bold">Pairing Code (tanpa scan)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Alternatif jika QR tidak muncul: di HP pilih <b>"Tautkan dengan nomor telepon"</b>, lalu masukkan kode 8 digit di bawah.
          </p>
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nomor, contoh 62817xxxxxxx"
              inputMode="tel"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button onClick={requestCode} disabled={loading}>
              {loading ? "Memuat..." : "Dapatkan Kode"}
            </Button>
          </div>

          {code && (
            <Alert tone="success">
              <p className="text-sm font-bold">Pairing Code:</p>
              <p className="text-2xl font-bold tracking-[0.3em]">{code}</p>
              <p className="text-xs text-muted-foreground">Segera masukkan di HP sebelum kedaluwarsa.</p>
            </Alert>
          )}

          {error && <Alert tone="danger">{error}</Alert>}
        </section>
      </div>
    </AdminLayout>
  )
}
