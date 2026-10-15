import { fileChecksum, partitionWithinBatch } from "@/lib/media-duplicate"
import { routeUrl } from "@/lib/routes"

/**
 * Antrean unggah media yang hidup di TINGKAT MODUL, bukan di dalam halaman.
 *
 * Dua masalah yang diselesaikan sekaligus (owner 2026-10-15):
 *
 * 1. Panel progress dulu hilang begitu admin berpindah halaman, karena daftar
 *    unggahan disimpan sebagai state komponen halaman, dan komponen itu dibuang
 *    saat halaman berganti. Karena state dan permintaan unggahnya kini hidup di
 *    modul, unggahan tetap berjalan dan panelnya tetap tersedia di halaman mana
 *    pun panel itu dipasang.
 *
 * 2. Unggahan dulu berjalan satu berkas pada satu waktu. Satu koneksi hanya
 *    sanggup sekitar 0,6 MB/detik sementara total koneksi admin sekitar
 *    1,4 MB/detik, sehingga kapasitasnya terbuang. Sekarang beberapa berkas naik
 *    bersamaan dengan batas "slot" (lihat SLOT_TOTAL dan SLOT_VIDEO).
 *
 * Sidik jari berkas tetap dihitung lebih dulu untuk mencegah berkas kembar di
 * dalam satu aksi unggah, sesuai kontrak dedup yang berlaku.
 */

export type UploadStatus =
  /** Sedang menghitung sidik jari berkas. */
  | "memeriksa"
  /** Sudah siap, menunggu slot unggah. */
  | "mengantre"
  /** Sedang dikirim ke server. */
  | "uploading"
  | "sukses"
  | "gagal"
  /** Berkas kembar di dalam aksi unggah yang sama. */
  | "ditolak"

export type UploadItem = {
  id: number
  name: string
  status: UploadStatus
  progress: number
  error?: string
}

export type MediaUploadState = { items: UploadItem[] }

/** Kunci simpanan sesi: panel tetap masuk akal setelah halaman dimuat ulang. */
const KUNCI_SIMPAN = "ragil.media.uploads"

/**
 * Total slot unggah bersamaan.
 *
 * Empat adalah titik jenuh yang terukur: pada uji 10 berkas, empat kanal memberi
 * sekitar 1,4 MB/detik sementara satu kanal 0,6 MB/detik, dan delapan kanal tidak
 * menambah apa pun. Menambah slot hanya menambah beban tanpa menambah kecepatan.
 */
const SLOT_TOTAL = 4

/**
 * Video memakai dua slot.
 *
 * Berkasnya jauh lebih besar (sampai 50 MB) dan SELURUH isinya dibaca server ke
 * memori, jadi dua video bersamaan sudah batas aman di server produksi (RAM
 * tersedia sekitar 1,9 GB dari 3,9 GB, dengan 12 pekerja PHP-FPM).
 */
const SLOT_VIDEO = 2

let keadaan: MediaUploadState = { items: [] }
let urutId = 0
let timerSimpan: number | null = null

const pendengar = new Set<() => void>()

function umumkan(): void {
  for (const cb of pendengar) cb()
}

/** Simpanan sesi ditulis tertunda: progres berubah sangat sering. */
function simpanRingkas(): void {
  if (typeof window === "undefined") return
  if (timerSimpan !== null) return
  timerSimpan = window.setTimeout(() => {
    timerSimpan = null
    try {
      window.sessionStorage.setItem(KUNCI_SIMPAN, JSON.stringify(keadaan.items))
    } catch {
      // sessionStorage bisa diblokir (mode privat). Panel tetap jalan sesi ini.
    }
  }, 400)
}

function gantiItem(berikut: UploadItem[]): void {
  keadaan = { items: berikut }
  simpanRingkas()
  umumkan()
}

/**
 * Pulihkan daftar dari simpanan sesi.
 *
 * Status yang masih berjalan TIDAK dibiarkan apa adanya: kalau modul ini baru
 * dimuat, permintaan unggah sebelumnya sudah tidak ada lagi (halaman dimuat
 * ulang atau tab dibuka kembali), jadi statusnya jujur ditandai terputus.
 */
function pulihkanRingkas(): UploadItem[] {
  if (typeof window === "undefined") return []
  try {
    const mentah = window.sessionStorage.getItem(KUNCI_SIMPAN)
    if (!mentah) return []
    const data: unknown = JSON.parse(mentah)
    if (!Array.isArray(data)) return []

    return (data as UploadItem[])
      .filter((u) => u && typeof u.id === "number" && typeof u.name === "string")
      .map((u) =>
        u.status === "memeriksa" || u.status === "mengantre" || u.status === "uploading"
          ? {
              ...u,
              status: "gagal" as const,
              progress: 0,
              error: "Terputus: halaman dimuat ulang saat unggahan berjalan.",
            }
          : u,
      )
  } catch {
    return []
  }
}

keadaan = { items: pulihkanRingkas() }
urutId = keadaan.items.reduce((maks, u) => (u.id > maks ? u.id : maks), 0)

export function subscribeUnggahan(cb: () => void): () => void {
  pendengar.add(cb)

  return () => {
    pendengar.delete(cb)
  }
}

export function snapshotUnggahan(): MediaUploadState {
  return keadaan
}

/** Apakah masih ada berkas yang diproses (memeriksa, menunggu, atau dikirim). */
export function adaUnggahanBerjalan(items: UploadItem[] = keadaan.items): boolean {
  return items.some(
    (u) => u.status === "memeriksa" || u.status === "mengantre" || u.status === "uploading",
  )
}

export function patchUnggahan(id: number, patch: Partial<Omit<UploadItem, "id" | "name">>): void {
  gantiItem(keadaan.items.map((u) => (u.id === id ? { ...u, ...patch } : u)))
}

export function bersihkanUnggahan(): void {
  gantiItem([])
}

function buatBatchId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function bobotBerkas(file: File): number {
  return file.type.startsWith("video/") ? SLOT_VIDEO : 1
}

/**
 * Jalankan pekerjaan dengan batas SLOT, bukan batas jumlah tugas.
 *
 * Bobot tiap tugas mewakili besar bebannya (video dua kali foto). Kepala antrean
 * tidak dilewati saat slotnya belum cukup, supaya urutan unggah tetap mengikuti
 * urutan pilihan admin.
 *
 * Diekspor untuk diuji langsung: ini bagian yang paling mudah salah (antrean
 * buntu, batas terlampaui), dan mengujinya lewat unggahan sungguhan butuh
 * peramban.
 */
export async function jalankanDenganSlot<T>(
  daftar: T[],
  bobot: (t: T) => number,
  kapasitas: number,
  kerjakan: (t: T) => Promise<void>,
): Promise<void> {
  const antre = [...daftar]
  let terpakai = 0
  const aktif = new Set<Promise<void>>()

  await new Promise<void>((selesai) => {
    const isi = (): void => {
      while (antre.length > 0) {
        const berikut = antre[0]
        // Bobot tidak pernah melebihi kapasitas, supaya antrean tidak bisa buntu
        // bila suatu saat kapasitas diturunkan di bawah bobot video.
        const butuh = Math.min(bobot(berikut), kapasitas)
        if (terpakai + butuh > kapasitas) break

        antre.shift()
        terpakai += butuh

        const bersih = kerjakan(berikut).finally(() => {
          terpakai -= butuh
          aktif.delete(bersih)
          if (antre.length === 0 && aktif.size === 0) selesai()
          else isi()
        })
        aktif.add(bersih)
      }

      if (antre.length === 0 && aktif.size === 0) selesai()
    }

    isi()
  })
}

/** Kirim satu berkas. Selalu selesai (tidak pernah melempar), hasilnya di state. */
function unggahSatu(
  id: number,
  file: File,
  folderId: string | null,
  csrf: string,
  intentId: number | null,
): Promise<void> {
  return new Promise((resolve) => {
    const fd = new FormData()
    fd.append("media", file)
    if (folderId) fd.append("folder_id", folderId)
    if (intentId !== null) fd.append("intent_id", String(intentId))

    const xhr = new XMLHttpRequest()
    xhr.open("POST", routeUrl("admin.media.upload"))
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest")
    xhr.setRequestHeader("X-CSRF-TOKEN", csrf)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        patchUnggahan(id, {
          progress: Math.min(99, Math.round((e.loaded / e.total) * 100)),
        })
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        patchUnggahan(id, { status: "sukses", progress: 100 })
      } else {
        let pesan = "Unggahan gagal"
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string }
          if (body?.message) pesan = body.message
        } catch {
          // Balasan bukan JSON (mis. halaman galat HTML); pakai pesan bawaan.
        }
        patchUnggahan(id, { status: "gagal", error: pesan })
      }
      resolve()
    }
    xhr.onerror = () => {
      patchUnggahan(id, { status: "gagal", error: "Unggahan terputus, periksa koneksi." })
      resolve()
    }
    xhr.onabort = () => {
      patchUnggahan(id, { status: "gagal", error: "Unggahan dibatalkan." })
      resolve()
    }
    xhr.send(fd)
  })
}

/**
 * Catat niat unggah di server SEBELUM byte bergerak.
 *
 * Ini yang membuat unggahan punya jejak: bila tab ditutup di tengah jalan,
 * barisnya tetap ada dan penyapu `media:close-stale-intents` menandainya
 * terputus, sehingga admin tahu berkas mana yang perlu diunggah ulang.
 *
 * Gagal mencatat BUKAN alasan menahan unggahan: hasilnya peta kosong dan berkas
 * tetap dikirim, hanya tanpa jejak tambahan.
 *
 * @returns peta urutan berkas -> id niat
 */
async function kirimNiat(
  berkas: Array<{ name: string; size_bytes: number; checksum: string | null }>,
  folderId: string | null,
  batchId: string,
  csrf: string,
): Promise<Map<number, number>> {
  const peta = new Map<number, number>()

  try {
    const res = await fetch(routeUrl("admin.media.upload-intents"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRF-TOKEN": csrf,
      },
      body: JSON.stringify({
        client_batch_id: batchId,
        folder_id: folderId || undefined,
        files: berkas,
      }),
    })
    if (!res.ok) return peta

    const body = (await res.json()) as { intent_ids?: number[] }
    const ids = Array.isArray(body.intent_ids) ? body.intent_ids : []
    ids.forEach((id, urutan) => {
      if (typeof id === "number") peta.set(urutan, id)
    })
  } catch {
    return new Map<number, number>()
  }

  return peta
}

/**
 * Mulai satu aksi unggah. Aman dipanggil walau halaman berpindah di tengah jalan:
 * pekerjaannya berjalan di tingkat modul, bukan milik komponen.
 */
export async function mulaiUnggah(input: {
  files: File[]
  folderId: string | null
  csrf: string
}): Promise<void> {
  const { files, folderId, csrf } = input
  if (files.length === 0) return

  const batchId = buatBatchId()
  const dasar = files.map((file) => ({ id: ++urutId, name: file.name, file }))

  // 1. Seluruh berkas tampil lebih dulu dengan status "memeriksa", supaya berkas
  //    besar tidak terkesan tidak terjadi apa-apa.
  gantiItem([
    ...keadaan.items,
    ...dasar.map(({ id, file }) => ({
      id,
      name: file.name,
      status: "memeriksa" as const,
      progress: 0,
    })),
  ])

  // 2. Sidik jari dihitung SERIAL, bukan paralel: menghitungnya membaca seluruh
  //    isi berkas ke memori peramban, jadi menumpuknya sekaligus membuat tab berat.
  const entri: Array<{ id: number; name: string; file: File; checksum: string | null }> = []
  for (const it of dasar) {
    entri.push({ ...it, checksum: await fileChecksum(it.file) })
    patchUnggahan(it.id, { status: "mengantre" })
  }

  // 3. Berkas kembar DI DALAM aksi unggah ini hanya boleh masuk sekali, karena di
  //    situ duplikat hampir pasti kecelakaan (berkas yang sama terpilih dua kali).
  //    Duplikat antar aksi unggah sengaja DIBIARKAN: admin toko sering memakai
  //    satu foto untuk dua produk yang dimensinya berdekatan, dan setiap produk
  //    tetap harus punya medianya sendiri di foldernya masing-masing.
  const { dup } = partitionWithinBatch(entri)
  const kembar = new Set(dup.map((d) => d.id))
  for (const d of dup) {
    patchUnggahan(d.id, { status: "ditolak", error: "Berkas kembar di aksi unggah ini" })
  }

  const kirim = entri
    .filter((e) => !kembar.has(e.id))
    .map((e, urutan) => ({ ...e, urutan }))

  // 4. Catat niat di server sebelum byte bergerak.
  const petaNiat = await kirimNiat(
    kirim.map((e) => ({
      name: e.file.name,
      size_bytes: e.file.size,
      checksum: e.checksum,
    })),
    folderId,
    batchId,
    csrf,
  )

  // 5. Jalankan dengan pembatas slot.
  await jalankanDenganSlot(
    kirim,
    (e) => bobotBerkas(e.file),
    SLOT_TOTAL,
    async (e) => {
      patchUnggahan(e.id, { status: "uploading", progress: 0 })
      await unggahSatu(e.id, e.file, folderId, csrf, petaNiat.get(e.urutan) ?? null)
    },
  )
}
