# Kolaborasi antar agent

Beberapa agent bekerja di working tree yang sama, kadang pada saat bersamaan.
Dokumen ini adalah prosedur supaya pekerjaan satu agent tidak hilang, tidak
ditimpa, dan tidak salah paham soal kondisi terkini.

Ringkasnya: **lihat dulu, baru tulis; catat setelah selesai; jangan timpa.**

## 1. Identitas agent

Semua commit repo ini tercatat atas nama mesin (`Ubuntu`), jadi tanpa penanda,
pekerjaan tidak bisa dibedakan pemiliknya. Aturan:

- Sebut agent id di awal laporan, misal `agent-ulasan`, `zcode-workflow`.
- Akhiri pesan commit dengan baris trailer:

      Agent: <agent-id>

  Contoh: `Agent: zcode-workflow`. Ini yang membuat `git log` bisa dibaca
  per pemilik nanti.

## 2. Sebelum menulis: lihat dulu

Jalankan:

    bash scripts/agent-state.sh

Skrip itu mencetak HEAD, selisih dengan origin, jumlah dan daftar berkas kotor
(termasuk apakah berkas kontrak ikut kotor), commit terakhir, dan entri terakhir
`docs/AGENT-LOG.md`. Dari situ terlihat apakah ada agent lain yang sedang
memegang berkas yang sama.

Aturan yang mengikat:

- **Berkas berstatus ` M` bukan berarti boleh ditimpa.** Itu pekerjaan agent lain
  yang belum di-commit. Jangan `git add` seluruh direktori, jangan
  `git checkout --` berkas itu, jangan `git stash` milik orang lain.
- Kalau berkas yang Anda butuhkan sedang kotor oleh agent lain, tambah saja
  (append) atau tulis di berkas berbeda. Jangan mengubah baris miliknya.
- Jangan commit berkas milik agent lain. Commit hanya berkas yang Anda sentuh.

## 3. Bila berkas kotor harus diubah, dan commit Anda hanya boleh memuat perubahan Anda

Ini kasus paling sering terjadi, misal `AGENTS.md` kotor oleh agent lain padahal
Anda perlu menambah satu bagian. `git add AGENTS.md` akan ikut membawa pekerjaan
mereka. Prosedur yang benar, tanpa menyentuh berkas kerja mereka:

    # 1. Salin versi HEAD ke berkas sementara
    git show HEAD:AGENTS.md > /tmp/base.md

    # 2. Sisipkan perubahan Anda ke berkas sementara itu (bukan ke berkas kerja)
    #    sehingga hasilnya = HEAD + perubahan Anda saja

    # 3. Jadikan blob dan panggungkan ke index, tanpa menyentuh berkas kerja
    SHA=$(git hash-object -w /tmp/mine.md)
    git update-index --cacheinfo 100755,$SHA,AGENTS.md

    # 4. Commit. Yang masuk hanya perubahan Anda.
    git commit -m "..."

    # 5. WAJIB: kembalikan berkas kerja agar memuat perubahan Anda DAN
    #    perubahan agent lain. Tanpa langkah ini berkas kerja kehilangan
    #    perubahan Anda, dan commit berikutnya oleh siapa pun bisa menghapusnya.

Langkah 5 sering terlewat. Gejalanya: `grep` teks Anda di berkas kerja memberi 0
padahal commit sudah ada. Insiden 2026-09-21: bagian "WORK TIER AND STEP BUDGET"
ada di commit dan di origin, tapi hilang dari berkas kerja `AGENTS.md`, sehingga
`git add AGENTS.md` oleh agent berikutnya akan menghapusnya. Perbaikannya dengan
menulis ulang berkas kerja = isi HEAD baru + baris milik agent lain.

Cara lebih aman untuk menghindari masalah ini: jangan pakai
`git update-index --cacheinfo` untuk berkas yang juga Anda butuhkan ada di berkas
kerja. Pakai urutan: salin isi berkas kerja (yang memuat pekerjaan agent lain) ke
berkas sementara, sisipkan perubahan Anda di atasnya, lalu tulis kembali ke berkas
kerja dan `git add` berkas itu. Dengan begitu berkas kerja dan commit sama-sama
memuat keduanya, dan tidak ada yang hilang.

## 4. Cermin lokal di `D:\website_5.0` bisa basi

Repo kerja ada di VPS. Workspace lokal `D:\website_5.0` adalah cermin untuk
dibaca. Cermin tidak ikut berubah sendiri. Bila ragu, selaraskan dulu:

    cd C:/Users/ragil/DataRecovery_D/_VERIFIKASI
    bash sync.sh      # VPS ke lokal
    bash regen.sh     # hasilkan ulang docs/TEKNIS dari kode
    bash verify.sh    # temukan dokumen yang basi

Insiden 2026-09-21: cermin sempat menarik versi `AGENTS.md` yang kehilangan
perubahan, lalu ikut salah sampai diselaraskan ulang. Selalu verifikasi isi
cermin, jangan hanya melihat tanggal berkas.

## 5. Spec dan data terkini menang atas dokumen

Sebelum mengklaim sesuatu benar, verifikasi kondisi terkini:

- **Spec:** kalau menambah route, field, enum, status, atau bentuk JSON, perbarui
  dokumen kanonik dan laporkan `SPEC_CHANGED_AND_DOCS_UPDATED`. Tanpa itu jangan
  dianggap selesai.
- **Data:** `docs/TEKNIS/` selalu akurat (dihasilkan dari kode). `docs/KONTRAK/`
  dan `docs/ADR/` bisa basi. Saat keduanya berbeda, kode dan data yang menang.
- **Bagian "Current status" di `AGENTS.md` adalah riwayat, bukan kondisi terkini.**
  Jangan memakainya sebagai dasar keputusan tanpa verifikasi.

## 6. Setelah selesai: catat

Tambahkan satu entri di `docs/AGENT-LOG.md` (formatnya ada di berkas itu). Wajib
untuk setiap task, termasuk yang gagal atau diblokir, karena task yang gagal juga
informasi yang dibutuhkan agent berikutnya.

Bila ada keputusan produk atau milestone, tambahkan juga di `docs/MEMORY.md`.

## 7. Ringkas dalam laporan

Setiap laporan perubahan menyebut: tier yang dipakai, jumlah panggilan tool
aktual, dan berkas yang disentuh. Tujuannya supaya pemakaian anggaran bisa
dinilai, bukan diasumsikan.
