# UX Flows

Kontrak final tetap berada di `docs/PRODUCT-HANDOFF.md`, route, dan controller. Dokumen ini
menjelaskan pengalaman pengguna tanpa menambah route atau field.

## Browse to buy

### Beranda (wireframe publik)

Urutan section:

1. Hero header (promo/banner)
2. Pilih model produk
3. Paling banyak dipesan
4. Cara pesan jendela Anda
5. Hasil pemasangan
6. Apa kata pelanggan kami — ulasan Shopee (admin) + ulasan produk website digabung satu daftar
7. Kami bantu dari awal sampai jadi
8. Tingkatkan kualitas bangunan bersama kami

Props Inertia: `promoSlides`, `modelCards`, `popularProducts`, `featuredProducts`, `testimonials`, `installations`.

1. Beranda menjelaskan pilihan model dan menampilkan media produk nyata.
2. Pengguna masuk ke hub model atau kategori.
3. Filter dan sort mengubah query string sehingga state dapat dibagikan dan dipulihkan.
4. Product detail meminta pengguna memilih varian sebelum menambah ke keranjang. Aksi “Beli sekarang” menambahkan varian dan jumlah yang sama, lalu langsung membuka checkout.
5. Cart memungkinkan perubahan jumlah dan penghapusan dengan feedback jelas.
6. Checkout memvalidasi identitas/alamat terlebih dahulu.
7. Pengguna memilih pembayaran dan membuat pesanan satu kali.
8. Confirmation menampilkan nomor pesanan dan langkah berikutnya.

## Track order

1. Pengguna membuka “Pesanan”.
2. Form meminta nomor order serta telepon atau email.
3. Loading menjelaskan bahwa data sedang dicocokkan.
4. Hasil menampilkan status order, payment, dan shipping sebagai tiga jalur yang saling terkait.
5. Mismatch tidak membocorkan keberadaan order pelanggan lain.

## Product selection

1. Media utama tetap terlihat ketika pengguna memilih ukuran/variasi.
2. Setiap pilihan memperbarui variant SKU, harga, stok, dimensi, dan media yang relevan.
3. Kombinasi yang belum lengkap menampilkan instruksi, bukan error.
4. Out-of-stock menonaktifkan add to cart dan menjelaskan alasannya.
5. Quantity tidak dapat kurang dari satu atau melebihi stok yang diketahui.

## Public recovery states

- Empty home data: tetap tampilkan navigation, model entry, dan bantuan.
- No catalog results: tampilkan filter aktif dan aksi reset.
- Missing product media: gunakan neutral media fallback dengan aspect ratio tetap.
- Empty cart: arahkan ke Model Produk.
- Shipping estimate fallback: jelaskan bahwa ongkir final dihitung sistem tanpa menggagalkan order.
- Order lookup mismatch: beri petunjuk format nomor dan telepon.

## Admin operational loop

1. Login menuju Dashboard.
2. Dashboard menonjolkan pekerjaan yang perlu perhatian.
3. Pesanan menjadi pusat operasi dan menghubungkan payment, shipping, serta WhatsApp.
4. Produk menghubungkan detail, variant, attribute, dan media.
5. Bulk catalog selalu melalui Import.
6. Critical mutation memberi confirmation dan feedback hasil.
7. Archive digunakan saat entitas tidak lagi aktif; tidak ada hard delete.

## Admin safety

- Status mutation menampilkan status saat ini dan status tujuan.
- Destructive/destructive-looking action menjelaskan dampak sebelum submit.
- Upload menunjukkan tipe dan batas ukuran file.
- Table desktop berubah menjadi record cards di mobile.
- Error parsial ditampilkan dekat record atau field yang gagal.
