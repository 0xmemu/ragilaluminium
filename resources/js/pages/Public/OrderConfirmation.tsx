import { Head, Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { PublicOrder } from "@/types"

function paymentMethodLabel(method: string | undefined): string {
  if (method === "transfer") return "Transfer Bank"
  if (method === "cod") return "COD"
  return method ? method : "-"
}

function formatOrderTime(value?: string): string {
  if (!value) return "-"
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  } catch {
    return value
  }
}

// Recipe visual mengikuti patokan canvas ILOTu-COD (b3meZk) / ILOTu-Transfer (y6gSKM).
export default function OrderConfirmation({
  order,
}: {
  order: PublicOrder
}) {
  const orderTime = formatOrderTime(order.created_at)
  const isTransfer = order.payment_method === "transfer"
  const statusLabel = isTransfer ? "Menunggu Pembayaran" : "Menunggu Konfirmasi"
  const helperCopy = isTransfer
    ? "Terima kasih sudah belanja di Ragil Aluminium. Admin kami akan segera menghubungi Anda melalui WhatsApp untuk mengirim info nomor rekening dan konfirmasi pesanan."
    : "Terima kasih sudah belanja di Ragil Aluminium. Admin kami akan menghubungi Anda melalui WhatsApp untuk konfirmasi pesanan."
  const noticeText = isTransfer
    ? `Transfer '${formatCurrency(order.total_amount)}' ke nomor rekening yang kami kirim melalui WhatsApp dan kirim bukti pembayaran. Admin akan konfirmasi pesanan setelah pembayaran diterima.`
    : "Anda memilih pembayaran COD. Siapkan pembayaran tunai saat barang tiba. Balas pesan WhatsApp kami agar pesanan segera diproses."

  return (
    <PublicLayout>
      <Head title={`Pesanan ${order.order_number}`} />

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <Breadcrumbs items={[{ label: "Beranda", href: routeUrl("home") }, { label: "Pesanan berhasil" }]} />
        </div>
        <div className="container-page py-2 !px-2.5 md:!px-8 lg:!px-12">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center lg:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-base font-bold tracking-tight text-[#333333]">
              Pesanan Berhasil
            </h1>
          </div>
        </div>
      </section>

      <section className="container-page !px-2.5 pt-2 pb-[calc(var(--mobile-bottom-nav-height)+1rem)] md:!px-8 lg:!px-12 sm:pt-6 lg:pb-10">
        <div className="mx-auto max-w-xl">
          {/* Hero sukses */}
          <div className="flex flex-col items-center pt-2 text-center">
            <Icon name="check-circle" weight="fill" className="size-[100px] text-[#2a734d]" aria-hidden="true" />
            <p className="mt-8 text-xl font-bold tracking-tight text-[#121212]">
              Pesanan anda berhasil dibuat!
            </p>
            <p className="mt-4 w-full text-[13px] leading-[1.78] text-[#666666]">{helperCopy}</p>
          </div>

          {/* Ringkasan Pesanan card */}
          <div className="mt-9 rounded-2xl border border-[#dee3e0] bg-surface p-5 sm:p-6">
            <span className="inline-block rounded-full bg-[#d9d9d9] px-3 py-1.5 text-xs font-bold text-[#121212]">
              {statusLabel}
            </span>
            <h2 className="mt-3 text-base font-bold text-[#121212]">Ringkasan Pesanan</h2>
            <dl className="mt-4 divide-y divide-[#dee3e0]">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-[13px] text-[#6B7280]">No. Pesanan</dt>
                <dd className="font-bold text-[#c20000]">{order.order_number}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-[13px] text-[#6B7280]">Metode Pembayaran</dt>
                <dd className="font-bold text-[#121212]">{paymentMethodLabel(order.payment_method)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-[13px] text-[#6B7280]">Waktu Pemesanan</dt>
                <dd className="font-bold text-[#121212]">{orderTime}</dd>
              </div>
            </dl>
          </div>

          {/* Notice metode (kotak merah) */}
          <div className="mt-5 rounded-2xl border border-[#bd1111] bg-[#bd11110d] p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#ffd9d9]">
                <Icon name="info" className="size-5 text-[#bd1111]" weight="bold" aria-hidden="true" />
              </span>
              <p className="text-sm leading-[1.71] text-[#c20000]">{noticeText}</p>
            </div>
          </div>

          {/* Trustline Belanja Aman (kartu abu) */}
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#dee3e0] bg-[#f7f8f7] p-4">
            <Icon name="shield-check" className="size-6 shrink-0 text-[#333333]" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold leading-[1.33] text-[#333333]">Belanja Aman &amp; Terpercaya</p>
              <p className="mt-1 text-xs leading-[1.33] text-[#666666]">
                Garansi jika produk rusak, pengiriman aman, dan pelayanan terbaik.
              </p>
            </div>
          </div>

          {/* CTA: duaduanya outline/ghost */}
          <div className="mt-5 flex flex-col gap-3 border-t border-[#dee3e0] pt-7 sm:flex-row">
            <Button asChild variant="secondary" size="lg" className="flex-1">
              <Link href={routeUrl("order.status")}>Cek Pesanan</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="flex-1">
              <Link href={routeUrl("home")}>Beranda</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}