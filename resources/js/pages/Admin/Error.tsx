import { Head, Link } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"

const COPY: Record<number, { title: string; body: string }> = {
  403: {
    title: "Akses dibatasi",
    body: "Akun Anda tidak memiliki izin untuk membuka halaman admin ini.",
  },
  404: {
    title: "Halaman admin tidak ditemukan",
    body: "Tautan mungkin salah atau halaman sudah dipindahkan. Kembali ke dashboard untuk melanjutkan.",
  },
  500: {
    title: "Gangguan sementara",
    body: "Sistem admin mengalami kendala. Coba lagi sebentar lagi atau hubungi pengelola teknis.",
  },
  503: {
    title: "Layanan sedang dirawat",
    body: "Panel admin sementara tidak tersedia. Silakan coba lagi nanti.",
  },
}

export default function AdminError({ status = 404 }: { status?: number }) {
  const copy = COPY[status] ?? COPY[404]

  return (
    <AdminLayout title={copy.title} description={copy.body}>
      <Head title={`${copy.title} | Admin`} />
      <section className="mx-auto flex max-w-xl flex-col items-start gap-6 rounded-xl border border-border bg-card p-8 shadow-sm">
        <p className="font-mono text-sm font-semibold text-muted-foreground">{status}</p>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{copy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.body}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={routeUrl("admin.dashboard")}>Ke Dashboard</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={routeUrl("admin.orders.index")}>Daftar pesanan</Link>
          </Button>
        </div>
      </section>
    </AdminLayout>
  )
}
