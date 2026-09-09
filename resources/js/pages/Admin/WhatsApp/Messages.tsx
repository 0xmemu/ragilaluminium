import * as React from "react"
import { Head, Link, router } from "@inertiajs/react"

import { AdminLayout } from "@/layouts/admin-layout"
import { Button } from "@/components/admin/ui/button"
import { Icon } from "@/components/shared/icon"
import { Card } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { routeUrl } from "@/lib/routes"

interface LastMessage {
  id: number
  text: string
  direction: "inbound" | "outbound"
  status: string
  created_at?: string | null
  created_at_label?: string | null
}

interface LatestOrder {
  id: number
  order_number: string
  order_status: string
  total_amount_formatted: string
}

interface ConversationItem {
  phone: string
  phone_formatted: string
  customer_name?: string | null
  is_channel: boolean
  message_count: number
  last_message?: LastMessage | null
  latest_order?: LatestOrder | null
}

interface ChatMessage {
  id: number
  direction: "inbound" | "outbound"
  status: string
  content_text: string
  internal_template_key?: string | null
  order_id?: number | null
  order_number?: string | null
  created_at?: string | null
  time_label?: string | null
  date_label?: string | null
}

interface CustomerContext {
  phone: string
  phone_formatted: string
  name: string
  city?: string | null
  total_orders: number
  orders: Array<{
    id: number
    order_number: string
    order_status: string
    total_amount_formatted: string
    href: string
  }>
}

interface GatewayStatus {
  connected: boolean
  status: string
  phone: string
}

interface MessagesPageProps {
  title: string
  search: string
  conversations: ConversationItem[]
  active_phone: string
  messages: ChatMessage[]
  customer_context?: CustomerContext | null
  gateway_status: GatewayStatus
  pairing_url: string
  templates_url: string
}

export default function WhatsAppMessagesPage({
  title,
  search: initialSearch,
  conversations,
  active_phone,
  messages,
  customer_context,
  gateway_status,
  pairing_url,
  templates_url,
}: MessagesPageProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = React.useState(initialSearch || "")
  const [activeTab, setActiveTab] = React.useState<"all" | "customers" | "channels">("all")
  const [replyText, setReplyText] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [copySuccess, setCopySuccess] = React.useState(false)

  const chatScrollRef = React.useRef<HTMLDivElement>(null)

  // Otomatis scroll ke bawah saat pesan dimuat atau pesan baru masuk
  React.useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages])

  // Filter daftar percakapan
  const filteredConversations = React.useMemo(() => {
    return conversations.filter((c) => {
      // Filter tab
      if (activeTab === "customers" && c.is_channel) return false
      if (activeTab === "channels" && !c.is_channel) return false

      // Filter teks pencarian
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const matchPhone = c.phone.toLowerCase().includes(q)
      const matchName = (c.customer_name || "").toLowerCase().includes(q)
      const matchOrder = (c.latest_order?.order_number || "").toLowerCase().includes(q)
      const matchText = (c.last_message?.text || "").toLowerCase().includes(q)

      return matchPhone || matchName || matchOrder || matchText
    })
  }, [conversations, activeTab, searchQuery])

  const activeConversation = React.useMemo(() => {
    return conversations.find((c) => c.phone === active_phone) || conversations[0]
  }, [conversations, active_phone])

  function selectConversation(phone: string) {
    router.get(
      routeUrl("admin.whatsapp.messages.index"),
      { phone },
      { preserveState: true, preserveScroll: true },
    )
  }

  function handleSendReply(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!replyText.trim() || !active_phone || isSubmitting) return

    setIsSubmitting(true)

    router.post(
      routeUrl("admin.whatsapp.messages.reply"),
      {
        phone_number: active_phone,
        message_text: replyText.trim(),
        order_id: activeConversation?.latest_order?.id || null,
      },
      {
        preserveScroll: true,
        onSuccess: () => {
          setReplyText("")
          setIsSubmitting(false)
        },
        onError: () => {
          setIsSubmitting(false)
        },
      },
    )
  }

  function handleCopyPhone() {
    if (!active_phone) return
    void navigator.clipboard.writeText(active_phone).then(() => {
      setCopySuccess(true)
      window.setTimeout(() => setCopySuccess(false), 1500)
    })
  }

  const quickTemplates = [
    "Halo kak, pesanan sedang kami proses ya.",
    "Pesanan sudah kami kirim, resi bisa dicek di detail pesanan.",
    "Bisa tolong konfirmasi alamat pengiriman lengkapnya kak?",
  ]

  const actions = (
    <div className="flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${
          gateway_status.connected
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            : "bg-destructive/10 text-destructive border-destructive/20"
        }`}
      >
        <span
          className={`size-2 rounded-full ${
            gateway_status.connected ? "bg-emerald-500 animate-pulse" : "bg-destructive"
          }`}
        />
        <span>
          {gateway_status.connected
            ? "Gateway Terhubung : " + gateway_status.phone
            : "Gateway Terputus"}
        </span>
      </div>

      <Button variant="outline" size="sm" asChild>
        <Link href={pairing_url} className="inline-flex items-center gap-1.5">
          <Icon name="whatsapp" className="size-3.5" />
          <span>Pairing QR</span>
        </Link>
      </Button>

      <Button variant="outline" size="sm" asChild>
        <Link href={templates_url} className="inline-flex items-center gap-1.5">
          <Icon name="clipboard-text" className="size-3.5" />
          <span>Template Pesan</span>
        </Link>
      </Button>
    </div>
  )

  return (
    <AdminLayout title={title} actions={actions}>
      <Head title="Live Chat WhatsApp : Panel Admin" />

      {/* Kontainer 3-Panel Live Chat */}
      <Card className="h-[calc(100vh-14rem)] min-h-[580px] overflow-hidden border border-border bg-card shadow-soft">
        <div className="grid h-full grid-cols-1 lg:grid-cols-12">
          {/* PANEL KIRI: Daftar Percakapan (4 kolom) */}
          <div className="flex flex-col border-b border-border lg:col-span-4 lg:border-b-0 lg:border-r">
            {/* Header Pencarian & Tab */}
            <div className="space-y-2 border-b border-border p-3">
              <div className="relative">
                <Icon
                  name="search"
                  className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kontak, nomor, atau pesanan..."
                  className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Segmented Control DS v2 */}
              <div className="inline-flex w-full rounded-md border border-border bg-surface p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`flex-1 rounded py-1 text-center font-medium transition ${
                    activeTab === "all"
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Semua ({conversations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("customers")}
                  className={`flex-1 rounded py-1 text-center font-medium transition ${
                    activeTab === "customers"
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pelanggan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("channels")}
                  className={`flex-1 rounded py-1 text-center font-medium transition ${
                    activeTab === "channels"
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Saluran
                </button>
              </div>
            </div>

            {/* List Kontak Percakapan */}
            <div className="flex-1 divide-y divide-border overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Tidak ada percakapan yang cocok.
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isActive = conv.phone === active_phone
                  const initial = (conv.customer_name || conv.phone).slice(0, 1).toUpperCase()
                  const isOutbound = conv.last_message?.direction === "outbound"

                  return (
                    <button
                      key={conv.phone}
                      type="button"
                      onClick={() => selectConversation(conv.phone)}
                      className={`group flex w-full items-start gap-3 p-3 text-left transition ${
                        isActive
                          ? "border-l-2 border-primary bg-primary/5 dark:bg-primary/10"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative mt-0.5 shrink-0">
                        <div
                          className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold ${
                            conv.is_channel
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {conv.is_channel ? (
                            <Icon name="bell" className="size-4" />
                          ) : (
                            initial
                          )}
                        </div>
                      </div>

                      {/* Info Chat */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {conv.customer_name || conv.phone_formatted}
                          </p>
                          {conv.last_message?.created_at_label ? (
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {conv.last_message.created_at_label}
                            </span>
                          ) : null}
                        </div>

                        {/* Nomor & Pesanan */}
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {conv.phone_formatted}
                          </span>
                          {conv.latest_order ? (
                            <span className="inline-flex rounded bg-primary/10 px-1 py-0.2 text-[9.5px] font-semibold text-primary">
                              {conv.latest_order.order_number}
                            </span>
                          ) : null}
                        </div>

                        {/* Cuplikan Teks Terakhir */}
                        {conv.last_message ? (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {isOutbound ? (
                              <span className="font-medium text-foreground/80">Anda: </span>
                            ) : null}
                            {conv.last_message.text}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* PANEL TENGAH: Ruang Chat & Balasan (5 kolom jika ada context, atau 8 kolom) */}
          <div
            className={`flex flex-col border-b border-border lg:border-b-0 ${
              customer_context ? "lg:col-span-5 xl:col-span-5" : "lg:col-span-8"
            }`}
          >
            {/* Header Chat Aktif */}
            <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {(activeConversation?.customer_name || active_phone || "P")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {activeConversation?.customer_name || active_phone}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {activeConversation?.phone_formatted || active_phone}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      title="Salin nomor WhatsApp"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Icon
                        name={copySuccess ? "badge-check" : "copy"}
                        className={`size-3 ${copySuccess ? "text-emerald-500" : ""}`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Aksi Cepat ke WhatsApp Asli */}
              <div className="flex items-center gap-1.5">
                {active_phone ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={"https://wa.me/" + active_phone.replace(/[^0-9]/g, "")}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="whatsapp" className="size-3.5 text-emerald-600" />
                      <span>Buka di WA</span>
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Area Balon Chat (Timeline) */}
            <div
              ref={chatScrollRef}
              className="flex-1 space-y-3 overflow-y-auto bg-surface/50 p-4"
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon name="chat" className="size-6" />
                  </div>
                  <p className="mt-2 text-xs font-medium text-foreground">
                    Belum ada riwayat pesan
                  </p>
                  <p className="mt-1 max-w-xs text-[11px] text-muted-foreground">
                    Kirim pesan pertama atau tunggu pelanggan menghubungi nomor toko.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOutbound = msg.direction === "outbound"
                  const prevMsg = messages[index - 1]
                  const showDate = !prevMsg || prevMsg.date_label !== msg.date_label

                  return (
                    <React.Fragment key={msg.id}>
                      {/* Pemisah Tanggal */}
                      {showDate && msg.date_label ? (
                        <div className="my-2 flex justify-center">
                          <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-xs">
                            {msg.date_label}
                          </span>
                        </div>
                      ) : null}

                      {/* Baris Balon Chat */}
                      <div
                        className={`flex w-full ${
                          isOutbound ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`relative max-w-[80%] rounded-2xl p-3 shadow-xs text-xs sm:max-w-[70%] ${
                            isOutbound
                              ? "rounded-tr-xs border border-primary/20 bg-primary/10 text-foreground"
                              : "rounded-tl-xs border border-border bg-card text-foreground"
                          }`}
                        >
                          {/* Badge Template Otomatis jika dari sistem */}
                          {msg.internal_template_key &&
                          msg.internal_template_key !== "free_form" ? (
                            <div className="mb-1 inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.2 text-[9px] font-semibold text-primary">
                              <span>Otomatis: {msg.internal_template_key}</span>
                            </div>
                          ) : null}

                          {/* Teks Pesan */}
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {msg.content_text}
                          </div>

                          {/* Footer Balon (Waktu & Tanda Terima) */}
                          <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                            <span>{msg.time_label}</span>

                            {/* Centang Status Pesan Keluar */}
                            {isOutbound ? (
                              msg.status === "read" ? (
                                <Icon
                                  name="checks"
                                  className="size-3.5 text-sky-500"
                                  
                                />
                              ) : msg.status === "delivered" ? (
                                <Icon
                                  name="checks"
                                  className="size-3.5 text-muted-foreground"
                                  
                                />
                              ) : msg.status === "sent" ? (
                                <Icon
                                  name="check"
                                  className="size-3 text-muted-foreground"
                                  
                                />
                              ) : msg.status === "failed" ? (
                                <span className="text-destructive font-bold">Gagal</span>
                              ) : (
                                <Icon
                                  name="clock"
                                  className="size-2.5 text-muted-foreground"
                                  
                                />
                              )
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  )
                })
              )}
            </div>

            {/* Input Bar Bawah (Ketik & Balas Cepat) */}
            <div className="border-t border-border bg-card p-3">
              {/* Quick Template Chips */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                {quickTemplates.map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setReplyText(tpl)}
                    className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[10.5px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    {tpl}
                  </button>
                ))}
              </div>

              {/* Form Textarea & Tombol Kirim */}
              <form onSubmit={handleSendReply} className="flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendReply()
                    }
                  }}
                  placeholder={
                    active_phone
                      ? "Ketik pesan WhatsApp (Enter untuk kirim)..."
                      : "Pilih percakapan untuk membalas..."
                  }
                  disabled={!active_phone || isSubmitting}
                  rows={2}
                  className="flex-1 resize-none rounded-md border border-border bg-surface p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />

                <Button
                  type="submit"
                  size="sm"
                  disabled={!replyText.trim() || !active_phone || isSubmitting}
                  className="h-14 px-4 text-xs font-semibold"
                >
                  {isSubmitting ? (
                    <Icon name="spinner" className="size-4 animate-spin" />
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <Icon name="whatsapp" className="size-4" />
                      <span>Kirim</span>
                    </div>
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* PANEL KANAN: Konteks Pelanggan & Pesanan Terkait (3 kolom jika ada context) */}
          {customer_context ? (
            <div className="flex flex-col divide-y divide-border border-l border-border bg-card p-4 lg:col-span-3 xl:col-span-3 overflow-y-auto">
              {/* Profil Pelanggan */}
              <div className="pb-4">
                <h3 className="text-xs font-semibold tracking-tight text-foreground">
                  Profil Pelanggan
                </h3>
                <div className="mt-2.5 space-y-1 text-xs">
                  <p className="font-semibold text-foreground">{customer_context.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {customer_context.phone_formatted}
                  </p>
                  {customer_context.city ? (
                    <p className="text-muted-foreground">{customer_context.city}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Total: {customer_context.total_orders} transaksi
                  </p>
                </div>
              </div>

              {/* Daftar Pesanan Terkait */}
              <div className="pt-4">
                <h3 className="text-xs font-semibold tracking-tight text-foreground">
                  Pesanan Pelanggan
                </h3>

                {customer_context.orders.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Belum ada riwayat pesanan.
                  </p>
                ) : (
                  <div className="mt-2.5 space-y-2">
                    {customer_context.orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="rounded-lg border border-border bg-surface p-2.5 text-xs transition hover:border-primary/40"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {ord.order_number}
                          </span>
                          <StatusBadge status={ord.order_status} />
                        </div>
                        <p className="mt-1 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {ord.total_amount_formatted}
                        </p>
                        <div className="mt-2">
                          <Link
                            href={ord.href}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                          >
                            <span>Lihat Detail Pesanan</span>
                            <Icon name="arrow-right" className="size-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </AdminLayout>
  )
}
