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

- **Eksekusi penuh hanya setelah gerbang di bagian 2b lolos.** Jalankan deteksinya dulu;
  jangan mulai menyalin berkas, commit, push, atau deploy sebelum keadaan dipastikan tenang.
- **Berkas berstatus ` M` bukan berarti boleh ditimpa.** Itu pekerjaan agent lain
  yang belum di-commit. Jangan `git add` seluruh direktori, jangan
  `git checkout --` berkas itu, jangan `git stash` milik orang lain.
- Kalau berkas yang Anda butuhkan sedang kotor oleh agent lain, tambah saja
  (append) atau tulis di berkas berbeda. Jangan mengubah baris miliknya.
- Jangan commit berkas milik agent lain. Commit hanya berkas yang Anda sentuh.

## 2b. Gerbang pra-eksekusi: deteksi kerja bersamaan dulu, baru eksekusi penuh

Disepakati owner 2026-10-14, setelah dua insiden nyata di hari yang sama: pekerjaan
agent lain tersapu saat menyalin berkas, dan rilis produksi tertimpa deploy agent lain
yang dibuat dari titik sebelum commit terkini. Keduanya terjadi karena eksekusi dimulai
sebelum memastikan keadaan repo dan produksi sedang tenang.

Aturannya: **deteksi dulu, eksekusi penuh hanya setelah aman.** Empat gerbang, masing
masing dengan perintah dan ambang yang jelas.

**Gerbang 1 - sebelum mulai bekerja.**

    bash scripts/agent-state.sh

Kalau ada berkas kotor, catat daftarnya. Berkas itu milik agent lain dan tidak boleh
disentuh. Kalau berkas yang Anda butuhkan ada di daftar itu, kerjakan bagian lain lebih
dulu, atau tulis di berkas berbeda.

**Gerbang 2 - sebelum commit.** Pastikan commit Anda hanya memuat berkas Anda.

    git status -s
    git diff --cached --name-only

Satu berkas bisa memuat pekerjaan dua agent sekaligus. Kalau begitu, commit per-hunk
(lihat bagian 3), jangan `git add <berkas>` begitu saja.

**Gerbang 3 - sebelum push.** Ref origin sering bergerak. Urutan wajib:

    git fetch origin
    git log --oneline HEAD..origin/<branch>     # ada isi = origin sudah maju
    git pull --rebase --autostash origin <branch>
    git push origin <branch>

`--autostash` menahan berkas kotor milik agent lain selama rebase lalu mengembalikannya.
**Buktikan pekerjaan mereka utuh** dengan membandingkan `md5sum` berkas kotor SEBELUM dan
SESUDAH rebase; angkanya harus sama. Kalau push ditolak karena `cannot lock ref`, jangan
ulangi perintah yang sama: fetch lagi, lalu nilai ulang.

**Gerbang 4 - sebelum deploy, dan sesudahnya.** Ini gerbang yang paling mudah terlewat.

Sebelum deploy, deteksi apakah ada deploy lain sedang berjalan. Skripnya dijalankan
**dari mesin lokal**, bukan dari dalam server, karena butuh kunci SSH produksi:

    bash scripts/agent-state-prod.sh

Skrip itu memeriksa empat hal, dan semuanya harus aman sebelum deploy dimulai:

1. Proses deploy yang masih hidup di produksi (`rsync`, `scp`, `cp -a`, `npm run build`,
   `vite build`, `composer install`, `php artisan migrate`). Kalau ada, TUNGGU.
2. Umur symlink `current` dan rilis terbaru di `releases/`. Rilis baru yang belum Anda
   kenal berarti agent lain baru deploy atau sedang deploy.
3. Apakah rilis live sudah memuat commit terkini, dengan membandingkan `md5sum` berkas
   kunci antara rilis live dan repo kerja. Kalau BERBEDA padahal Anda tidak merasa
   mengubah apa pun, selidiki dulu.
4. Aktivitas tulis terakhir di `storage/logs` sebagai tanda aplikasi sedang sibuk.

Kalau ada yang tidak aman, **tunggu sampai selesai**, jangan melanjutkan.

Tiga larangan yang lahir dari insiden nyata:

- **Jangan menyalin berkas pilihan dari working tree.** Menyalin beberapa berkas dari 209
  membawa serta ketergantungan yang belum ada di produksi (kasus `MediaStoragePurger`:
  controller yang memanggilnya ikut tersalin, kelasnya tidak, dan aksi hapus media jadi
  gagal). Deploy dari satu titik commit yang lengkap, bukan dari potongan berkas.
- **Jangan menganggap rilis dasar sudah memuat commit Anda.** Rilis yang dibuat agent lain
  bisa berasal dari titik sebelum commit Anda. Periksa berkas kuncinya di rilis itu, bukan
  hanya mengandalkan `current` menunjuk rilis terbaru.
- **Jangan menimpa rilis yang sedang live.** Buat rilis baru di sampingnya, lalu pindahkan
  symlink `current`. Rilis lama adalah titik rollback.

Sesudah deploy, buktikan yang live memang memuat perubahan Anda: ambil nama chunk dari
`public/build/manifest.json`, `curl` chunk itu dari domain live, dan periksa penanda
perubahannya ada. Untuk perubahan server, jalankan pemeriksaan terhadap kode di
`current`, bukan terhadap kode di working tree.

Kalau ada gerbang yang tidak lolos, **berhenti dan lapor**, bukan melanjutkan dengan
asumsi bahwa semuanya akan baik-baik saja.

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

## 7. Push: cek dulu, jangan ulang buta

Ringkasan prosedurnya ada di gerbang 3 bagian 2b. Bagian ini menyimpan riwayat dan
alasannya.

Branch ini dipakai bersama, jadi ref di origin sering bergerak di bawah kaki.
Sesi 2026-09-21: tiga percobaan push gagal berturut-turut, dua karena ref sudah
bergerak (pertama non-fast-forward, lalu cannot lock ref dengan expected hash
lama). Itu murni kerja yang terbuang, dan penyebabnya bukan repo melainkan urutan
yang salah.

Urutan yang benar sebelum push:

    git fetch origin
    git log --oneline HEAD..origin/<branch>      # ada isi = origin sudah maju
    git push origin HEAD:<branch>

- Kalau `HEAD..origin/<branch>` kosong, push aman (fast-forward).
- Kalau ada isi, JANGAN mengirim ulang perintah push. Integrasikan dulu commit Anda
  di atas origin (rebase commit sendiri), baru push.
- Kalau push gagal dengan non-fast-forward atau cannot lock ref, hentikan.
  Jalankan `git fetch` lalu nilai ulang.

Larangan paksa: jangan menulis ulang riwayat remote (opsi paksa pada push), dan
jangan membuang perubahan yang belum di-commit dengan reset keras pada working
tree. Dua hal itu sudah ditegakkan guard repo ini, lihat bagian guard di
`AGENTS.md`. Opsi lease (force-with-lease) hanya untuk membungkus ulang commit
Anda SENDIRI yang sudah di-push, misal setelah rebase, dan hanya setelah fetch
sehingga Anda tahu persis posisi origin.

Sesudah push, pastikan commit Anda benar-benar mendarat:

    git merge-base --is-ancestor <commit> origin/<branch> && echo OK

Catatan: pre-push hook repo ini menjalankan `npm run typecheck && npm run build`.
Build mengosongkan `public/build`, sehingga halaman live 500 sementara. Pilih waktu
push, dan jangan menjalankannya bersamaan dengan test.

## 8. Ringkas dalam laporan

Setiap laporan perubahan menyebut: tier yang dipakai, jumlah panggilan tool
aktual, dan berkas yang disentuh. Tujuannya supaya pemakaian anggaran bisa
dinilai, bukan diasumsikan.
