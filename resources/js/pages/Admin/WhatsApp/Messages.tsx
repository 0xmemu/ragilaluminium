import * as React from "react"
import { Head, Link, router } from "@inertiajs/react"

import { AdminLayout } from "@/layouts/admin-layout"
import { Button } from "@/components/admin/ui/button"
import { Icon } from "@/components/shared/icon"
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
  conversations,
  active_phone,
  messages,
  customer_context,
  gateway_status,
  pairing_url,
  templates_url,
}: MessagesPageProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<"all" | "customers" | "channels">("customers")
  const [replyText, setReplyText] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [copySuccess, setCopySuccess] = React.useState(false)
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [chatSearchOpen, setChatSearchOpen] = React.useState(false)
  const [chatSearchQuery, setChatSearchQuery] = React.useState("")
  const [showScrollBottom, setShowScrollBottom] = React.useState(false)

  const chatContainerRef = React.useRef<HTMLDivElement>(null)
  const quickRepliesScrollRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const [isDraggingQuickReplies, setIsDraggingQuickReplies] = React.useState(false)
  const dragStartXRef = React.useRef(0)
  const dragScrollLeftRef = React.useRef(0)
  const hasDraggedRef = React.useRef(false)

  // Ubah putaran roda mouse (wheel) menjadi geser horizontal pada bar balas cepat
  React.useEffect(() => {
    const el = quickRepliesScrollRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent): void => {
      if (e.deltaY !== 0) {
        e.preventDefault()
        el.scrollLeft += e.deltaY * 1.2
      }
    }

    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [])

  // Otomatis scroll ke pesan terbawah dengan opsi smooth
  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      })
    }
  }, [])

  React.useEffect(() => {
    scrollToBottom("auto")
  }, [active_phone, scrollToBottom])

  React.useEffect(() => {
    scrollToBottom("smooth")
  }, [messages.length, scrollToBottom])

  // Deteksi posisi scroll untuk memunculkan tombol melayang 'Scroll ke bawah'
  function handleChatScroll(): void {
    if (!chatContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    const distanceToBottom = scrollHeight - scrollTop - clientHeight
    setShowScrollBottom(distanceToBottom > 150)
  }

  // Filter daftar kontak percakapan
  const filteredConversations = React.useMemo(() => {
    return conversations.filter((c) => {
      if (activeTab === "customers" && c.is_channel) return false
      if (activeTab === "channels" && !c.is_channel) return false

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

  // Filter pesan di dalam chat aktif jika pencarian chat terbuka
  const filteredMessages = React.useMemo(() => {
    if (!chatSearchOpen || !chatSearchQuery.trim()) return messages
    const q = chatSearchQuery.toLowerCase()
    return messages.filter((m) => m.content_text.toLowerCase().includes(q))
  }, [messages, chatSearchOpen, chatSearchQuery])

  function selectConversation(phone: string): void {
    if (phone === active_phone) return
    router.get(
      routeUrl("admin.whatsapp.messages.index"),
      { phone },
      { preserveState: true, preserveScroll: true },
    )
  }

  function handleSendReply(e?: React.FormEvent): void {
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
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
          }
          scrollToBottom("smooth")
        },
        onError: () => {
          setIsSubmitting(false)
        },
      },
    )
  }

  function handleCopyPhone(): void {
    if (!active_phone) return
    void navigator.clipboard.writeText(active_phone).then(() => {
      setCopySuccess(true)
      window.setTimeout(() => setCopySuccess(false), 1500)
    })
  }

  function handleQuickReplyClick(text: string): void {
    setReplyText(text)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  function handleQuickMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    if (!quickRepliesScrollRef.current) return
    setIsDraggingQuickReplies(true)
    hasDraggedRef.current = false
    dragStartXRef.current = e.pageX - quickRepliesScrollRef.current.offsetLeft
    dragScrollLeftRef.current = quickRepliesScrollRef.current.scrollLeft
  }

  function handleQuickMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
    if (!isDraggingQuickReplies || !quickRepliesScrollRef.current) return
    e.preventDefault()
    const x = e.pageX - quickRepliesScrollRef.current.offsetLeft
    const walk = (x - dragStartXRef.current) * 1.5
    if (Math.abs(walk) > 4) {
      hasDraggedRef.current = true
    }
    quickRepliesScrollRef.current.scrollLeft = dragScrollLeftRef.current - walk
  }

  function handleQuickMouseUpOrLeave(): void {
    setIsDraggingQuickReplies(false)
  }

  function handleChipSelect(tpl: string): void {
    if (hasDraggedRef.current) return
    handleQuickReplyClick(tpl)
  }

  // Auto-resize textarea mengikuti panjang teks
  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setReplyText(e.target.value)
    const target = e.target
    target.style.height = "auto"
    target.style.height = Math.min(target.scrollHeight, 120) + "px"
  }

  const quickTemplates = [
    "Halo kak, pesanan sedang kami siapkan ya.",
    "Pesanan sudah kami kirim, resi bisa dicek di detail pesanan.",
    "Bisa tolong konfirmasi alamat pengiriman lengkapnya kak?",
    "Apakah spesifikasi kaca (Bening/Riben/Es) sudah sesuai pesanan kak?",
    "Barang sudah dipacking kayu rapi dan siap dijemput kurir J&T Cargo.",
    "Foto hasil pemasangan sudah tersedia, mau kami kirimkan kak?",
    "Stok ready siap kirim, mau kami proses hari ini kak?",
    "Mohon menunggu sebentar, tim workshop sedang memeriksa ukuran kusen.",
  ]

  return (
    <AdminLayout fullWidth>
      <Head title="Live Chat WhatsApp : Panel Admin" />

      {/* Kontainer Utama Live Chat Full Viewport */}
      <div className="flex h-full w-full overflow-hidden bg-background">
        {/* ==================================================================== */}
        {/* PANEL KIRI: DAFTAR KONTAK & PERCAKAPAN (Lebar Tetap 350px di Desktop) */}
        {/* ==================================================================== */}
        <aside className="flex h-full w-full flex-col border-r border-border bg-[hsl(210_20%_96%)] transition-all duration-300 sm:w-80 md:w-96 shrink-0">
          {/* Header Panel Kiri */}
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Icon name="whatsapp" className="size-4" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Pesan WhatsApp
              </h2>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" asChild title="Pairing QR WhatsApp">
                <Link href={pairing_url}>
                  <Icon name="gear" className="size-4 text-muted-foreground" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon-sm" asChild title="Daftar Template Pesan">
                <Link href={templates_url}>
                  <Icon name="clipboard-text" className="size-4 text-muted-foreground" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Kotak Pencarian Kontak */}
          <div className="border-b border-border p-3 space-y-2.5">
            <div className="relative">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kontak, nomor, atau pesanan..."
                className="w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Icon name="x" className="size-3" />
                </button>
              ) : null}
            </div>

            {/* Segmented Filter Tab Geser */}
            <div className="flex rounded-lg border border-border bg-card/60 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("customers")}
                className={`flex-1 rounded-md py-1 text-center font-medium transition-all duration-200 ${
                  activeTab === "customers"
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Pelanggan
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`flex-1 rounded-md py-1 text-center font-medium transition-all duration-200 ${
                  activeTab === "all"
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Semua ({conversations.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("channels")}
                className={`flex-1 rounded-md py-1 text-center font-medium transition-all duration-200 ${
                  activeTab === "channels"
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Saluran
              </button>
            </div>
          </div>

          {/* Daftar Percakapan dengan Smooth Scroll */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60 scroll-smooth">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
                <Icon name="chat" className="size-8 opacity-40 mb-2" />
                <span>Tidak ada percakapan yang cocok.</span>
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
                    className={`group relative flex w-full items-start gap-3 p-3.5 text-left transition-all duration-150 ${
                      isActive
                        ? "bg-card shadow-xs"
                        : "hover:bg-card/50"
                    }`}
                  >
                    {/* Active indicator bar di sisi kiri */}
                    {isActive ? (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                    ) : null}

                    {/* Avatar Profil */}
                    <div className="relative shrink-0 mt-0.5">
                      <div
                        className={`flex size-10 items-center justify-center rounded-full text-xs font-bold transition-transform group-hover:scale-105 ${
                          conv.is_channel
                            ? "bg-muted text-muted-foreground"
                            : isActive
                              ? "bg-primary text-primary-foreground shadow-xs"
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

                    {/* Konten Chat Item */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`truncate text-xs font-semibold ${isActive ? "text-primary dark:text-primary-foreground" : "text-foreground"}`}>
                          {conv.customer_name || conv.phone_formatted}
                        </p>
                        {conv.last_message?.created_at_label ? (
                          <span className="shrink-0 text-[10px] text-muted-foreground font-medium">
                            {conv.last_message.created_at_label}
                          </span>
                        ) : null}
                      </div>

                      {/* Nomor & Badge Pesanan */}
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-muted-foreground truncate">
                          {conv.phone_formatted}
                        </span>
                        {conv.latest_order ? (
                          <span className="shrink-0 rounded bg-primary/15 px-1 py-0.2 font-mono text-[9.5px] font-semibold text-primary">
                            {conv.latest_order.order_number}
                          </span>
                        ) : null}
                      </div>

                      {/* Cuplikan Teks Terakhir */}
                      {conv.last_message ? (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
                          {isOutbound ? (
                            <span className="font-semibold text-foreground/90">Anda: </span>
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

          {/* Footer Status Gateway Baileys */}
          <div className="border-t border-border bg-card/40 p-2.5 px-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${
                    gateway_status.connected
                      ? "bg-emerald-500 animate-pulse shadow-xs"
                      : "bg-destructive"
                  }`}
                />
                <span className="text-[11px] font-medium text-muted-foreground truncate">
                  {gateway_status.connected
                    ? "Terhubung : " + gateway_status.phone
                    : "Gateway terputus"}
                </span>
              </div>

              <Link
                href={pairing_url}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Kelola
              </Link>
            </div>
          </div>
        </aside>

        {/* ==================================================================== */}
        {/* PANEL TENGAH: RUANG CHAT LIVE & STREAM PESAN                         */}
        {/* ==================================================================== */}
        <section className="relative flex flex-1 flex-col h-full overflow-hidden bg-surface/30">
          {/* Header Chat Aktif */}
          <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 shadow-xs shrink-0 z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {(activeConversation?.customer_name || active_phone || "P")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-xs font-semibold text-foreground">
                    {activeConversation?.customer_name || active_phone}
                  </h3>
                  {activeConversation?.latest_order ? (
                    <span className="rounded bg-primary/15 px-1 py-0.2 font-mono text-[10px] font-bold text-primary">
                      {activeConversation.latest_order.order_number}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {activeConversation?.phone_formatted || active_phone}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    title="Salin nomor WhatsApp"
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    <Icon
                      name={copySuccess ? "badge-check" : "copy"}
                      className={`size-3 ${copySuccess ? "text-emerald-500" : ""}`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Aksi Header Chat */}
            <div className="flex items-center gap-1.5">
              {/* Tombol Pencarian di dalam chat */}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setChatSearchOpen((prev) => !prev)}
                title="Cari pesan dalam percakapan"
                className={chatSearchOpen ? "bg-muted text-foreground" : "text-muted-foreground"}
              >
                <Icon name="search" className="size-4" />
              </Button>

              {/* Tautan langsung ke WhatsApp Web */}
              {active_phone ? (
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={"https://wa.me/" + active_phone.replace(/[^0-9]/g, "")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Icon name="whatsapp" className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">Buka di WA</span>
                  </a>
                </Button>
              ) : null}

              {/* Tombol Buka/Tutup Panel Info Pelanggan */}
              {customer_context ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSidebarOpen((prev) => !prev)}
                  title={sidebarOpen ? "Tutup detail pelanggan" : "Buka detail pelanggan"}
                  className={sidebarOpen ? "bg-muted text-foreground" : "text-muted-foreground"}
                >
                  <Icon name="user" className="size-4" />
                </Button>
              ) : null}
            </div>
          </header>

          {/* Baris Pencarian Pesan Dalam Chat (Dapat disembunyikan) */}
          {chatSearchOpen ? (
            <div className="flex items-center gap-2 border-b border-border bg-card p-2 px-4 animate-in slide-in-from-top-2 duration-150">
              <Icon name="search" className="size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder="Cari teks di percakapan ini..."
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setChatSearchQuery("")
                  setChatSearchOpen(false)
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="x" className="size-3.5" />
              </button>
            </div>
          ) : null}

          {/* Area Timeline Chat dengan WhatsApp Wallpaper Feel */}
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth bg-radial from-surface/80 to-surface/40"
            style={{
              backgroundImage:
                "radial-gradient(var(--border) 0.75px, transparent 0.75px)",
              backgroundSize: "20px 20px",
            }}
          >
            {filteredMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-6">
                <div className="flex size-14 items-center justify-center rounded-full bg-card border border-border shadow-soft text-muted-foreground mb-3">
                  <Icon name="chat" className="size-6 text-primary" />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {chatSearchQuery ? "Tidak ada pesan yang cocok" : "Belum ada riwayat pesan"}
                </p>
                <p className="mt-1 max-w-xs text-[11px] text-muted-foreground">
                  {chatSearchQuery
                    ? "Coba gunakan kata kunci pencarian yang lain."
                    : "Ketik balasan di bawah untuk memulai percakapan langsung via WhatsApp."}
                </p>
              </div>
            ) : (
              filteredMessages.map((msg, index) => {
                const isOutbound = msg.direction === "outbound"
                const prevMsg = filteredMessages[index - 1]
                const showDate = !prevMsg || prevMsg.date_label !== msg.date_label

                return (
                  <React.Fragment key={msg.id}>
                    {/* Pemisah Tanggal WhatsApp Style */}
                    {showDate && msg.date_label ? (
                      <div className="my-3 flex justify-center sticky top-2 z-10">
                        <span className="rounded-full border border-border/80 bg-card/90 backdrop-blur-xs px-3 py-0.5 text-[10px] font-medium text-muted-foreground shadow-xs">
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
                        className={`group relative max-w-[85%] sm:max-w-[72%] rounded-2xl p-3 shadow-xs text-xs transition-shadow hover:shadow-md ${
                          isOutbound
                            ? "rounded-tr-xs border border-primary/20 bg-primary/10 text-foreground"
                            : "rounded-tl-xs border border-border bg-card text-foreground"
                        }`}
                      >
                        {/* Chip Template Otomatis dari Sistem */}
                        {msg.internal_template_key &&
                        msg.internal_template_key !== "free_form" ? (
                          <div className="mb-1.5 flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-0.5 text-[9.5px] font-semibold text-primary">
                            <Icon name="bell" className="size-3" />
                            <span>Pesan Otomatis Toko ({msg.internal_template_key})</span>
                          </div>
                        ) : null}

                        {/* Isi Teks Pesan */}
                        <div className="whitespace-pre-wrap leading-relaxed select-text">
                          {msg.content_text}
                        </div>

                        {/* Footer Balon Chat (Waktu & Tanda Terima) */}
                        <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
                          <span className="font-mono">{msg.time_label}</span>

                          {/* Centang Tanda Terima WhatsApp */}
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
                              <span className="font-bold text-destructive">Gagal</span>
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

          {/* Tombol Melayang Jump to Bottom */}
          {showScrollBottom ? (
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="absolute bottom-28 right-6 z-20 flex size-9 items-center justify-center rounded-full border border-border bg-card shadow-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
              aria-label="Scroll ke pesan terakhir"
            >
              <Icon name="caret-down" className="size-4" weight="bold" />
            </button>
          ) : null}

          {/* Baris Balas Cepat Geser (Horizontal Quick Replies Scroll) */}
          <div className="border-t border-border/80 bg-card px-3 pt-2.5 select-none">
            <div
              ref={quickRepliesScrollRef}
              onMouseDown={handleQuickMouseDown}
              onMouseMove={handleQuickMouseMove}
              onMouseUp={handleQuickMouseUpOrLeave}
              onMouseLeave={handleQuickMouseUpOrLeave}
              className={`flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none cursor-grab ${
                isDraggingQuickReplies ? "cursor-grabbing" : ""
              }`}
            >
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                <Icon name="chat" className="size-3 text-primary" />
                <span>Balas cepat:</span>
              </span>
              {quickTemplates.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleChipSelect(tpl)}
                  className="shrink-0 rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-muted-foreground transition-all hover:border-primary hover:text-foreground hover:bg-primary/5 active:scale-95"
                >
                  {tpl}
                </button>
              ))}
            </div>

            {/* Input Form Balas Pesan */}
            <form onSubmit={handleSendReply} className="flex items-end gap-2 pb-3">
              <div className="relative flex-1 rounded-xl border border-border bg-surface shadow-xs focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition">
                <textarea
                  ref={textareaRef}
                  value={replyText}
                  onChange={handleTextareaInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendReply()
                    }
                  }}
                  placeholder={
                    active_phone
                      ? "Ketik pesan WhatsApp (Enter untuk kirim, Shift+Enter baris baru)..."
                      : "Pilih percakapan terlebih dahulu..."
                  }
                  disabled={!active_phone || isSubmitting}
                  rows={1}
                  className="w-full resize-none bg-transparent p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none max-h-32"
                />
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={!replyText.trim() || !active_phone || isSubmitting}
                className="h-10 px-4 rounded-xl font-semibold transition active:scale-95 shrink-0"
              >
                {isSubmitting ? (
                  <Icon name="spinner" className="size-4 animate-spin" />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Icon name="whatsapp" className="size-4" />
                    <span>Kirim</span>
                  </div>
                )}
              </Button>
            </form>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* PANEL KANAN: INSPECTOR KONTEKS PELANGGAN & PESANAN (Collapsible)     */}
        {/* ==================================================================== */}
        {customer_context ? (
          <aside
            className={`flex flex-col border-l border-border bg-card transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
              sidebarOpen ? "w-80 max-w-[20rem] opacity-100" : "w-0 max-w-0 opacity-0 border-l-0 pointer-events-none"
            }`}
          >
            {/* Header Inspector */}
            <div className="flex h-14 items-center justify-between border-b border-border px-4 shrink-0">
              <h3 className="text-xs font-semibold tracking-tight text-foreground">
                Informasi Pelanggan
              </h3>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSidebarOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="x" className="size-4" />
              </Button>
            </div>

            {/* Konten Profil & Pesanan */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-border/70 scroll-smooth">
              {/* Profil Singkat */}
              <div className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {customer_context.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">
                      {customer_context.name}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                      {customer_context.phone_formatted}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 rounded-lg border border-border bg-surface p-3 text-xs">
                  {customer_context.city ? (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                        Alamat Pengiriman
                      </span>
                      <p className="mt-0.5 font-medium text-foreground">
                        {customer_context.city}
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                      Aktivitas Transaksi
                    </span>
                    <p className="mt-0.5 font-semibold text-foreground">
                      {customer_context.total_orders} pesanan selesai / berjalan
                    </p>
                  </div>
                </div>
              </div>

              {/* Daftar Pesanan Aktif Pelanggan */}
              <div className="pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground tracking-tight">
                    Riwayat Pesanan
                  </h4>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {customer_context.orders.length} order
                  </span>
                </div>

                {customer_context.orders.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">
                    Belum ada riwayat pesanan.
                  </p>
                ) : (
                  customer_context.orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="group rounded-xl border border-border bg-surface p-3 text-xs transition-all hover:border-primary/50 hover:shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground font-mono">
                          {ord.order_number}
                        </span>
                        <StatusBadge status={ord.order_status} />
                      </div>

                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-[11px] text-muted-foreground">Total:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          {ord.total_amount_formatted}
                        </span>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/60">
                        <Link
                          href={ord.href}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-card border border-border py-1 text-[11px] font-semibold text-primary transition group-hover:border-primary/40 group-hover:bg-primary/5"
                        >
                          <span>Buka Detail Pesanan</span>
                          <Icon name="arrow-right" className="size-3" />
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </AdminLayout>
  )
}
