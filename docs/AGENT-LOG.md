# Log perubahan agent

Ledger tiap perubahan oleh agent. Append-only: tambahkan entri baru di BAWAH,
jangan menyunting entri lama. Tujuannya membuat pekerjaan tiap agent terlihat
oleh sesi berikutnya tanpa perlu bertanya.

Beda dengan `docs/MEMORY.md`: berkas ini mencatat SEMUA perubahan (mekanis,
ringkas, wajib tiap task). `docs/MEMORY.md` hanya keputusan dan milestone
(kurasi, tidak wajib tiap task). Kalau ragu, tulis di sini dulu.

## Format entri

    ## YYYY-MM-DD HH:MM UTC | <agent-id> | <tier> | <commit> | <status>
    Lingkup: apa yang diubah, berkas utama
    Dampak spec: tidak berubah | SPEC_CHANGED_AND_DOCS_UPDATED
    Untuk agent berikutnya: hal yang harus dijaga atau dihindari
    Bukti: perintah dan hasil nyata

- `<agent-id>`: nama sesi atau peran, misal `zcode-workflow` atau `agent-ulasan`.
- `<tier>`: Trivial | Standard | Deep sesuai anggaran di `AGENTS.md`.
- `<status>`: selesai | selesai-sebagian | diblokir.
- `<commit>`: hash pendek, atau `-` bila tidak ada commit.

Riwayat sebelum 2026-09-21 tidak diisi di sini, lihat `git log` untuk itu.
Prosedur lengkap kolaborasi: `docs/AGENT-COLLABORATION.md`.
Jalankan `bash scripts/agent-state.sh` sebelum mulai bekerja.

---

## 2026-09-20 18:38 UTC | zcode-workflow | Deep | b9f20142 | selesai
Lingkup: kontrak efisiensi agent. `docs/ORCHESTRATION.md` (tier Trivial/Standard/Deep
plus anggaran 15/60/270, aturan ssh sekali panggil, bukti visual sekali batch, aturan
sekali ditolak ganti pendekatan, aturan tool sesuai scope), `docs/decisions/ADR-002`
(amandemen tier), `AGENTS.md` (titik masuk tier di Non-negotiables),
`.compound-engineering/config.yaml` (baru, docs_root + plan_output).
Dampak spec: tidak berubah (tidak ada route, schema, enum, atau JSON).
Untuk agent berikutnya: anggaran tool berlaku per task. Skill ce-brainstorm, ce-plan,
ce-compound, ce-doc-review hanya dipanggil di tier Deep. `maxAttempts` 11 milik runtime
CLI, tidak bisa diubah dari config. Pre-push hook menjalankan build yang mengosongkan
`public/build` dan membuat situs live 500 sementara, jadi push perlu dipilih waktunya.
Bukti: `git log --oneline` tujuh commit (59020c53..b9f20142); alat ukur
`_agent-metrics/agent-metrics.sh` di workspace lokal; 3 permintaan push, 2 ditolak
karena ref branch bergerak, build pre-push lulus di semua percobaan.

## 2026-09-21 10:44 UTC | zcode-workflow | Standard | - | selesai
Lingkup: mekanisme dokumentasi lintas agent. Berkas BARU: `docs/AGENT-LOG.md`
(ledger ini), `docs/AGENT-COLLABORATION.md` (prosedur), `scripts/agent-state.sh`
(briefing pra-kerja). `AGENTS.md` mendapat bagian "Papan kolaborasi agent".
Dampak spec: tidak berubah.
Untuk agent berikutnya: jalankan `bash scripts/agent-state.sh` sebelum menyentuh
berkas. Berkas kotor ` M` milik agent lain JANGAN ditimpa; ikuti prosedur
`docs/AGENT-COLLABORATION.md`. Sertakan baris `Agent: <id>` di pesan commit karena
semua commit repo ini tercatat atas nama mesin `Ubuntu`.
Bukti: `bash scripts/agent-state.sh` mencetak berkas kotor, selisih origin, dan
entri log terakhir.

## 2026-09-21 11:02 UTC | zcode-workflow | Trivial | b102c5e3 | selesai
Lingkup: papan kolaborasi juga dipasang di sisi LOKAL `D:\website_5.0`.
`AGENTS.md` lokal (berkas yang disuntik harness ke setiap sesi workspace ini)
mendapat bagian "0. Papan kolaborasi agent", dan berkas baru
`_agent-metrics/agent-state.sh` menjadi pembungkus yang menyambung ke
`scripts/agent-state.sh` di VPS dalam SATU panggilan ssh (3,8 detik, bukan
berkali-kali).
Dampak spec: tidak berubah.
Untuk agent berikutnya: `AGENTS.md` repo VPS dan `AGENTS.md` lokal adalah DUA
berkas berbeda dengan isi berbeda. Repo VPS yang mengikat kode; versi lokal
mengikat sesi di workspace `D:\website_5.0`. Perubahan kontrak harus mendarat di
KEDUANYA, kalau tidak sesi lokal dan sesi VPS bisa memakai aturan berbeda.
Bukti: `bash _agent-metrics/agent-state.sh` dari workspace lokal mencetak
briefing lengkap dalam satu koneksi; `grep -c "Papan kolaborasi agent" AGENTS.md`
lokal = 1.

## 2026-09-21 12:05 UTC | zcode | Standard | - | selesai
Lingkup: memperbaiki penyebab halaman gagal dimuat (HTTP 500) setiap kali build
frontend berjalan di server 209. Ini bagian pertama dari diagnosa kondisi server;
kelambatan situs adalah masalah terpisah dan belum diperbaiki.
Akar masalah: perintah npm run build menulis langsung ke public/build dan mengosongkan
folder itu lebih dulu. Selama jendela build, berkas public/build/manifest.json (daftar
nama berkas hasil build yang dipakai Laravel untuk memanggil CSS dan JS) tidak ada,
sehingga setiap halaman dijawab 500 ViteManifestNotFoundException. Dua pemicunya:
scripts/prod/deploy.sh baris 78, dan .git/hooks/pre-push baris 28 (hook ini tidak
terlacak git, jadi perubahannya hanya ada di server ini).
Perubahan: berkas BARU scripts/prod/build-assets.sh. Build ditulis ke salah satu dari
dua slot di dalam public/ sehingga masih satu filesystem dengan public/build dan
pemindahannya hanya rename, bukan salin. public/build ditukar hanya setelah
manifest.json hasil build terverifikasi, jadi tidak pernah ada jendela waktu tanpa
manifest. Dua slot dipakai bergantian sehingga tidak diperlukan perintah hapus. deploy.sh
dan pre-push hook kini memanggil skrip itu. .gitignore menambah /public/build-slot-*.
Dampak spec: tidak berubah (tidak ada route, schema, enum, atau JSON).
Verifikasi: dua putaran build sambil halaman dipantau tiap 0,2 detik, hasil 45/45 dan
46/46 jawaban HTTP 200, manifest.json tidak pernah hilang, nol error Vite setelah
perbaikan, dan aset yang dirujuk halaman tersaji 200 dari build baru.
Untuk agent berikutnya: jangan memanggil npm run build langsung di repo 209, pakai
bash scripts/prod/build-assets.sh. Kalau ada sisa public/build-slot-a atau
public/build-slot-b, berarti ada run yang gagal, jalankan skrip sekali lagi untuk
membereskannya. Kelambatan situs BELUM diperbaiki: terowongan QUIC hanya mengalir 1
sampai 80 KB per detik padahal aplikasi membalas 0,24 detik. Uji berikutnya adalah
menjalankan cloudflared dengan --protocol http2.
