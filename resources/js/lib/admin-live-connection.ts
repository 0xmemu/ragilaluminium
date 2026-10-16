import * as React from "react"

import { routeUrl } from "@/lib/routes"
import {
  CONNECT_TIMEOUT_MS,
  HEARTBEAT_MS,
  LIVENESS_MS,
  STALE_MS,
  isStale,
  leaseExpired,
  shouldReloadOnVersion,
} from "@/lib/admin-live-lease"

/**
 * Pemilik tunggal koneksi live panel admin (Tahap 3 live events, 16 Okt 2026).
 *
 * Sebelumnya DUA berkas membuat sambungan Echo dan berlangganan kanal yang sama
 * (live-notification-manager.tsx dan admin-live-events.ts), dan polling 8 detik
 * berjalan di SETIAP tab admin. Dengan sekitar 12 tab terbuka, puncaknya 93
 * permintaan per menit ke satu endpoint, dan tiap permintaan dulu menjalankan
 * query agregat 14 subquery.
 *
 * Modul ini menyelesaikannya dengan tiga aturan:
 * 1. SATU sambungan WebSocket per peramban. Hanya tab pemimpin yang menyambung;
 *    tab lain menerima kabar darinya lewat BroadcastChannel.
 * 2. SATU denyut data per peramban, tiap 120 detik (dulu 8 detik per tab).
 * 3. Pemimpin selalu tab yang sedang terlihat, sehingga peramban tidak bergantung
 *    pada tab latar yang timernya dibatasi peramban.
 *
 * Kegagalan ditutup, bukan diabaikan:
 * - Echo tidak tersedia atau gagal dimuat: status "unavailable", dan denyut data
 *   tetap berjalan sebagai jalur utama.
 * - BroadcastChannel tidak didukung: setiap tab menjadi pemimpin sendiri
 *   (perilaku lama), tanpa error.
 * - Pemimpin ditutup atau membeku: tab lain mengambil alih setelah klaim
 *   kedaluwarsa, lalu menyelaraskan diri sekali.
 * - Sambungan pulih setelah putus (termasuk karena deploy): penyelarasan sekali.
 */

export type AdminLiveState = "connecting" | "connected" | "reconnecting" | "disconnected" | "unavailable"

export type AdminLiveEventName = "order.created" | "order.updated" | "whatsapp.received" | "shipping.updated"

export interface AdminLiveNotificationPayload {
  id: number
  type: string
  title: string
  body?: string | null
  href?: string | null
  created_at?: string | null
}

export interface AdminLiveEventMessage {
  type: "event"
  event: AdminLiveEventName
  data: unknown
}

export interface AdminLiveSyncMessage {
  type: "sync"
  reason: "heartbeat" | "reconnect" | "visible" | "version"
  version?: string
  latestId?: number
  notifications?: AdminLiveNotificationPayload[]
}

export type AdminLiveMessage = AdminLiveEventMessage | AdminLiveSyncMessage

export interface AdminLiveSnapshot {
  state: AdminLiveState
  leader: boolean
  stale: boolean
  lastEventAt: string | null
}

type EchoChannel = {
  subscribed(cb: () => void): unknown
  listen(event: string, cb: (data: never) => void): unknown
  error(cb: (e: unknown) => void): unknown
}

type EchoConnection = {
  bind(event: string, cb: (...args: unknown[]) => void): unknown
}

type EchoClient = {
  private(channel: string): EchoChannel
  leaveChannel(channel: string): void
  connector?: { pusher?: { connection?: EchoConnection } }
}

declare global {
  interface Window {
    Echo?: EchoClient
  }
}

const CHANNEL_NAME = "private-admin.operations"
const BC_NAME = "ragil-admin-live"
const TAB_ID = Math.random().toString(36).slice(2)

const SERVER_EVENTS: AdminLiveEventName[] = [
  "order.created",
  "order.updated",
  "whatsapp.received",
  "shipping.updated",
]

/** Infra broadcast tersedia bila key reverb dikonfigurasi untuk peramban. */
const echoAvailable = Boolean(import.meta.env.VITE_REVERB_APP_KEY)

interface Internal {
  started: boolean
  state: AdminLiveState
  leader: boolean
  lastMessageAt: number
  lastEventAt: string | null
  lastClaimAt: number
  leaderId: string | null
  version: string | null
  echoAttached: boolean
  everConnected: boolean
  messageHandlers: Set<(m: AdminLiveMessage) => void>
  stateHandlers: Set<() => void>
  bc: BroadcastChannel | null
  livenessTimer: number | null
  heartbeatTimer: number | null
  connectGuardTimer: number | null
  echoInit: Promise<EchoClient | null> | null
}

const s: Internal = {
  started: false,
  state: echoAvailable ? "connecting" : "unavailable",
  leader: false,
  lastMessageAt: 0,
  lastEventAt: null,
  lastClaimAt: 0,
  leaderId: null,
  version: null,
  echoAttached: false,
  everConnected: false,
  messageHandlers: new Set(),
  stateHandlers: new Set(),
  bc: null,
  livenessTimer: null,
  heartbeatTimer: null,
  connectGuardTimer: null,
  echoInit: null,
}

function setState(next: AdminLiveState): void {
  if (s.state === next) return
  s.state = next
  s.stateHandlers.forEach((fn) => fn())
}

function emit(m: AdminLiveMessage): void {
  s.lastMessageAt = Date.now()
  s.messageHandlers.forEach((fn) => fn(m))
}

function visible(): boolean {
  return typeof document === "undefined" || !document.hidden
}

/** Kirim pesan ke tab lain, kalau BroadcastChannel tersedia. */
function post(message: unknown): void {
  try {
    s.bc?.postMessage(message)
  } catch {
    // Channel bisa sudah ditutup saat tab dibongkar; diabaikan.
  }
}

/**
 * Menjadi pemimpin: menyambung Echo, menjalankan denyut data, dan meneruskan
 * kabar ke tab lain.
 */
function becomeLeader(): void {
  if (s.leader) return
  s.leader = true
  s.lastClaimAt = Date.now()
  s.leaderId = TAB_ID
  s.stateHandlers.forEach((fn) => fn())
  attachEcho()
  scheduleHeartbeat()
  void pollNow("heartbeat")

  // Pengaman: bila sambungan tidak terbentuk dalam batas waktu, status dinyatakan
  // terputus. Tanpa ini, kegagalan otentikasi kanal meninggalkan status
  // "connecting" selamanya dan label "Menghubungkan pembaruan langsung..." tampil
  // terus di panel admin.
  if (s.connectGuardTimer !== null) window.clearTimeout(s.connectGuardTimer)
  s.connectGuardTimer = window.setTimeout(() => {
    s.connectGuardTimer = null
    if (s.leader && s.state !== "connected") {
      setState("disconnected")
    }
  }, CONNECT_TIMEOUT_MS)
}

function resignLeadership(): void {
  if (!s.leader) return
  s.leader = false
  s.stateHandlers.forEach((fn) => fn())
  detachEcho()
  if (s.heartbeatTimer !== null) {
    window.clearInterval(s.heartbeatTimer)
    s.heartbeatTimer = null
  }
}

/**
 * Token CSRF untuk permintaan otorisasi kanal.
 *
 * Diambil dari meta tag yang sudah ada di layout, dengan cadangan dari cookie
 * XSRF-TOKEN. Tanpa token ini server menjawab 419.
 */
function tokenCsrf(): string {
  try {
    const meta = document.querySelector('meta[name="csrf-token"]')
    const dariMeta = meta?.getAttribute("content") ?? ""
    if (dariMeta !== "") return dariMeta

    const bagian = document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="))

    return bagian ? decodeURIComponent(bagian.split("=").slice(1).join("=")) : ""
  } catch {
    return ""
  }
}

/**
 * Pengotorisasi kanal eksplisit (Tahap 3 lanjutan, 17 Okt 2026).
 *
 * Kenapa tidak memakai bawaan pustaka: bentuk permintaan bawaan pernah TIDAK
 * terbaca server. Saat isi permintaan berbentuk JSON tetapi headernya menyatakan
 * form-urlencoded, server tidak menemukan nama kanal, lalu menjawab 403 dengan
 * pesan kosong. Gejala di panel: "Pembaruan langsung terputus", padahal sesi
 * admin sah (halaman /admin sendiri dijawab 200 pada detik yang sama).
 *
 * Di sini bentuknya ditentukan sendiri dan tidak bergantung pada pustaka lain:
 * JSON dengan header JSON, cookie disertakan eksplisit, token CSRF dikirim lewat
 * header. Dengan begitu tidak ada lagi ketidakcocokan header dan isi.
 */
interface KanalEcho {
  name: string
}

interface DataOtorisasi {
  auth: string
  channel_data?: string
  shared_secret?: string
}

export function authorizerKanal(
  channel: KanalEcho,
  _options: unknown,
): { authorize: (socketId: string, callback: (error: Error | null, data: DataOtorisasi | null) => void) => void } {
  return {
    authorize: (socketId: string, callback: (error: Error | null, data: DataOtorisasi | null) => void) => {
      void fetch("/broadcasting/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-TOKEN": tokenCsrf(),
        },
        body: JSON.stringify({ socket_id: socketId, channel_name: channel.name }),
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error("Otorisasi kanal gagal dengan status " + res.status)
          }

          return res.json()
        })
        .then((data) => callback(null, data))
        .catch((e: unknown) => callback(e instanceof Error ? e : new Error(String(e)), null))
    },
  }
}

async function ensureEcho(): Promise<EchoClient | null> {
  if (!echoAvailable) return null
  if (window.Echo) return window.Echo
  if (s.echoInit) return s.echoInit

  s.echoInit = (async () => {
    try {
      // Klien Pusher WAJIB diserahkan. laravel-echo 2.x tidak lagi menyertakannya
      // dan akan MELEMPAR "Pusher client not found" saat connect(), sehingga
      // sambungan WebSocket tidak pernah terbentuk.
      const [{ default: Echo }, { default: Pusher }] = await Promise.all([
        import("laravel-echo"),
        import("pusher-js"),
      ])
      if (window.Echo) return window.Echo

      const host = (import.meta.env.VITE_REVERB_HOST as string) || window.location.hostname
      const scheme = (import.meta.env.VITE_REVERB_SCHEME as string) || "https"
      const isTls = scheme === "https"
      const port = Number(import.meta.env.VITE_REVERB_PORT ?? 443)

      window.Echo = new Echo({
        broadcaster: "reverb",
        key: import.meta.env.VITE_REVERB_APP_KEY as string,
        Pusher,
        authorizer: authorizerKanal,
        wsHost: host,
        wsPort: isTls ? 80 : port,
        wssPort: isTls ? port : 443,
        forceTLS: isTls,
        enabledTransports: ["ws", "wss"],
      }) as unknown as EchoClient

      return window.Echo
    } catch {
      s.echoInit = null
      return null
    }
  })()

  return s.echoInit
}

/** Sambungkan Echo dan pasang pendengar event server. Hanya pemimpin. */
function attachEcho(): void {
  if (!echoAvailable || s.echoAttached) return

  void (async () => {
    const echo = await ensureEcho()

    if (!echo) {
      // Jangan diam di status "connecting". Kegagalan harus terbaca, dan denyut
      // data tetap menjadi jalur pembaruan.
      setState("unavailable")

      return
    }

    if (!s.leader || s.echoAttached) return

    try {
      const channel = echo.private(CHANNEL_NAME)

      channel.subscribed(() => {
        if (!s.leader) return
        const pulih = s.everConnected
        s.everConnected = true
        if (s.connectGuardTimer !== null) {
          window.clearTimeout(s.connectGuardTimer)
          s.connectGuardTimer = null
        }
        setState("connected")
        // Penyelarasan saat sambungan pulih: menutup celah event yang terjadi
        // ketika sambungan putus, mis. saat deploy me-restart layanan.
        if (pulih) void pollNow("reconnect")
      })
      channel.error(() => setState("disconnected"))

      for (const nama of SERVER_EVENTS) {
        channel.listen(`.${nama}`, (data: unknown) => {
          if (!s.leader) return
          s.lastMessageAt = Date.now()
          s.lastEventAt = new Date().toISOString()
          const pesan: AdminLiveEventMessage = { type: "event", event: nama, data }
          emit(pesan)
          post({ kind: "relay", from: TAB_ID, message: pesan })
        })
      }

      const conn = echo.connector?.pusher?.connection
      conn?.bind("disconnected", () => setState("disconnected"))
      conn?.bind("reconnecting", () => setState("reconnecting"))
      conn?.bind("connected", () => setState("connected"))

      s.echoAttached = true
    } catch {
      // Sama: jangan tinggalkan status di "connecting".
      setState("unavailable")
      s.echoAttached = false
    }
  })()
}

function detachEcho(): void {
  if (!s.echoAttached) return
  try {
    window.Echo?.leaveChannel(CHANNEL_NAME)
  } catch {
    // Diabaikan: kanal bisa sudah lepas.
  }
  s.echoAttached = false
}

function scheduleHeartbeat(): void {
  if (s.heartbeatTimer !== null) return
  s.heartbeatTimer = window.setInterval(() => {
    if (!s.leader) return
    // Tab latar tidak melakukan denyut data; tab terlihat akan menggantikannya.
    if (!visible()) return
    void pollNow("heartbeat")
  }, HEARTBEAT_MS)
}

/**
 * Satu permintaan denyut ke server. Mengembalikan penanda versi terbaru dan
 * notifikasi yang belum terlihat.
 */
async function pollNow(reason: AdminLiveSyncMessage["reason"]): Promise<void> {
  try {
    const url = routeUrl("admin.notifications.poll") + "?last_id=0"
    const res = await fetch(url, {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    })
    if (!res.ok) return

    const data = (await res.json()) as {
      latest_id?: number
      data_version?: string
      new_notifications?: AdminLiveNotificationPayload[]
    }

    const versiBaru = typeof data.data_version === "string" ? data.data_version : undefined
    const berubah = shouldReloadOnVersion(s.version, versiBaru)
    s.version = versiBaru ?? s.version

    const pesan: AdminLiveSyncMessage = {
      type: "sync",
      reason: berubah ? "version" : reason,
      version: versiBaru,
      latestId: typeof data.latest_id === "number" ? data.latest_id : undefined,
      notifications: Array.isArray(data.new_notifications) ? data.new_notifications : undefined,
    }

    emit(pesan)
    post({ kind: "relay", from: TAB_ID, message: pesan })
  } catch {
    // Kegagalan jaringan sesaat diabaikan; denyut berikutnya mencoba lagi.
  }
}

/** Ambil alih kepemimpinan bila klaim pemimpin sekarang sudah kedaluwarsa. */
function maybeTakeLeadership(): void {
  if (s.leader) {
    s.lastClaimAt = Date.now()
    return
  }
  if (!visible()) return
  if (!leaseExpired(Date.now(), s.lastClaimAt)) return
  becomeLeader()
}

function start(): void {
  if (s.started) return
  s.started = true
  s.lastMessageAt = Date.now()

  try {
    s.bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(BC_NAME) : null
  } catch {
    s.bc = null
  }

  if (s.bc) {
    s.bc.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as { kind?: string; from?: string; message?: AdminLiveMessage; at?: number }
      if (!msg || msg.from === TAB_ID) return

      if (msg.kind === "claim") {
        // Klaim pemimpin lain dicatat supaya tab ini tidak berebut.
        s.lastClaimAt = typeof msg.at === "number" ? msg.at : Date.now()
        s.leaderId = msg.from ?? null
        if (s.leader && msg.from !== TAB_ID) resignLeadership()
        return
      }

      if (msg.kind === "relay" && msg.message) {
        // Kabar dari pemimpin: diteruskan ke komponen di tab ini.
        emit(msg.message)
      }
    }
  }

  // Tanpa BroadcastChannel, setiap tab menjadi pemimpin sendiri (perilaku lama).
  if (!s.bc) {
    becomeLeader()
  } else {
    maybeTakeLeadership()
  }

  s.livenessTimer = window.setInterval(() => {
    if (visible()) {
      if (s.leader) {
        s.lastClaimAt = Date.now()
        post({ kind: "claim", from: TAB_ID, at: s.lastClaimAt })
      } else {
        maybeTakeLeadership()
      }
    } else if (s.leader) {
      // Tab pemimpin pindah ke latar: menyerahkan agar tab terlihat mengambil
      // alih dan denyut data tidak ikut dibatasi peramban.
      resignLeadership()
    }
  }, LIVENESS_MS)

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (!visible()) {
        if (s.leader) resignLeadership()
        return
      }
      if (!s.leader) {
        maybeTakeLeadership()
      } else {
        void pollNow("visible")
      }
    })
  }

  window.addEventListener("beforeunload", () => {
    try {
      s.bc?.close()
    } catch {
      // Diabaikan.
    }
  })
}

/** Langganan pesan live (event server dan kabar penyelarasan). */
export function subscribeAdminLive(handler: (m: AdminLiveMessage) => void): () => void {
  start()
  s.messageHandlers.add(handler)

  return () => {
    s.messageHandlers.delete(handler)
  }
}

/**
 * Snapshot yang WAJIB stabil antar panggilan.
 *
 * useSyncExternalStore membandingkan hasil getSnapshot dengan Object.is. Dulu
 * fungsi ini selalu mengembalikan objek baru DAN memanggil Date.now(), sehingga
 * React menganggap store berubah di setiap pemeriksaan dan render berulang tanpa
 * henti (React error 185, "Maximum update depth exceeded"). Seluruh panel admin
 * ikut runtuh karena hook ini dipakai di layout.
 *
 * Sekarang objek di-cache dan hanya dibuat ulang saat nilainya benar-benar
 * berubah. Waktu ikut masuk kunci cache dalam bentuk ember kasar berdurasi
 * STALE_MS, sehingga "basi" tetap bisa berubah sendiri (paling cepat sekali per
 * STALE_MS) tanpa membuat identitas objek berubah di setiap pembacaan.
 */
let cachedSnapshot: AdminLiveSnapshot | null = null
let cachedKey = ""

export function readAdminLiveSnapshot(): AdminLiveSnapshot {
  const emberWaktu = Math.floor(Date.now() / STALE_MS)
  const key = [
    s.state,
    s.leader ? "1" : "0",
    s.lastMessageAt,
    s.lastEventAt ?? "",
    emberWaktu,
  ].join("|")

  if (cachedSnapshot !== null && cachedKey === key) return cachedSnapshot

  cachedKey = key
  cachedSnapshot = {
    state: s.state,
    leader: s.leader,
    stale: isStale(Date.now(), s.lastMessageAt),
    lastEventAt: s.lastEventAt,
  }

  return cachedSnapshot
}

/**
 * Status koneksi live untuk komponen. Memakai useSyncExternalStore supaya
 * pembacaan konsisten dan tidak ada render berlebih.
 */
/** Langganan status; didefinisikan sekali supaya identitasnya stabil. */
function subscribeState(cb: () => void): () => void {
  start()
  s.stateHandlers.add(cb)

  return () => {
    s.stateHandlers.delete(cb)
  }
}

export function useAdminLive(): AdminLiveSnapshot & { refresh: () => void } {
  const snap = React.useSyncExternalStore(
    subscribeState,
    readAdminLiveSnapshot,
    readAdminLiveSnapshot,
  )

  const refresh = React.useCallback(() => {
    if (s.leader) void pollNow("visible")
  }, [])

  // Objek hasil dibungkus useMemo dengan kunci snapshot supaya identitasnya
  // stabil selama snapshot tidak berubah. Tanpa ini, konsumen yang memakai
  // nilai balik ini sebagai dependensi ikut render berulang.
  return React.useMemo(() => ({ ...snap, refresh }), [snap, refresh])
}



