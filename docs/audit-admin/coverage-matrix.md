# Coverage matrix surface admin (Fase A)

80 route baca yang merender halaman Inertia. route JSON/redirect/unduh tidak masuk tabel ini.

**Cara membaca kolom State dan Interaksi.** Keduanya hasil pemindaian pola teks pada source,
bukan hasil pengujian perilaku. Artinya `loading` hanya berarti berkas itu memuat kata kunci
terkait, bukan berarti state itu benar benar dirancang dan pernah terlihat. Kolom State hanya
berguna untuk menemukan halaman yang sama sekali tidak menyebut state apa pun, dan untuk itu
hasilnya nol, tidak ada halaman seperti itu. Penilaian mutu state ada di laporan, bukan di sini.
Kolom Interaksi memakai deteksi kata kunci; kolom `unduh` sengaja dipisah dari kata kunci
`export` TypeScript karena `export` di source berarti kata kunci modul, bukan tombol unduh.

| Modul | Surface (view) | Route | Menu | State terdeteksi | Interaksi | Tabel | Panduan |
|---|---|---|---|---|---|---|---|
| (root) | `Dashboard` | `/admin` | Beranda | empty | filter, upload, submit | - | ya |
| activity-logs | `ActivityLogs/Index` | `/admin/activity-logs` | Log Aktivitas | empty | search, filter, sort, pagination, unduh, submit | tabel mentah | ya |
| analytics | `Analytics/StorePerformance` | `/admin/analytics/store-performance` | Performa Toko | empty | search, filter, modal/drawer, upload, unduh, submit | tabel mentah | ya |
| announcements | `Announcements/Index` | `/admin/announcements` | Promo Toko | loading, empty | search, filter, sort, pagination, upload, submit | tabel mentah | tidak |
| announcements | `Announcements/Form` | `/admin/announcements/{announcement}/edit` | Promo Toko | loading, error | sort | - | tidak |
| announcements | `Announcements/Form` | `/admin/announcements/create` | Promo Toko | loading, error | sort | - | tidak |
| banners | `Banners/Index` | `/admin/banners` | Promo Toko | loading, empty, error, submitting | search, sort, pagination, upload, submit | tabel mentah | tidak |
| banners | `Banners/Form` | `/admin/banners/{banner}/edit` | Promo Toko | loading, error | sort, upload | - | tidak |
| banners | `Banners/Form` | `/admin/banners/create` | Promo Toko | loading, error | sort, upload | - | tidak |
| beranda | `Beranda/Index` | `/admin/beranda` | TIDAK | loading, submitting | sort | - | ya |
| beranda | `Beranda/HowToOrderForm` | `/admin/beranda/how-to-order` | TIDAK | loading, empty, error, submitting | filter | - | tidak |
| beranda | `Beranda/Popular` | `/admin/beranda/paling-banyak-dipesan` | Paling Banyak Dipesan | loading, empty, submitting | search, filter, sort | tabel mentah | tidak |
| cara-pemesanan | `CaraPemesanan/Edit` | `/admin/cara-pemesanan` | Cara Pemesanan | loading, error, submitting | search, filter, upload | - | ya |
| cod-settings | `CodSettings/Edit` | `/admin/cod-settings` | Biaya COD | loading, error, submitting, flash | - | tabel mentah | ya |
| customers | `Customers/Index` | `/admin/customers` | Customer | loading, empty | search, filter, sort, pagination, upload, unduh, submit | tabel mentah | ya |
| customers | `Customers/Edit` | `/admin/customers/{customer}/edit` | Customer | loading, empty, error, submitting | - | - | ya |
| documents | `Beranda/Index` | `/admin/documents` | Dokumen Halaman | loading, submitting | sort | - | tidak |
| faq | `Faq/Index` | `/admin/faq` | Sering Ditanyakan | loading, empty, error, submitting, flash | search, filter, sort, submit | - | ya |
| gallery-items | `Testimonials/GalleryForm` | `/admin/gallery-items/{galleryItem}/edit` | Ulasan | loading, error, submitting | sort, upload | - | tidak |
| gallery-items | `Testimonials/GalleryForm` | `/admin/gallery-items/create` | Ulasan | loading, error, submitting | sort, upload | - | tidak |
| hasil-pemasangan | `InstallationGallery/Index` | `/admin/hasil-pemasangan` | Hasil Pemasangan | loading, empty, submitting | search, filter, sort, submit | tabel mentah | tidak |
| hasil-pemasangan | `InstallationGallery/Show` | `/admin/hasil-pemasangan/detail` | Hasil Pemasangan | loading, empty, error, submitting | filter, upload, submit | tabel mentah | tidak |
| hasil-pemasangan | `InstallationGallery/Form` | `/admin/hasil-pemasangan/tambah` | Hasil Pemasangan | loading, empty, error, submitting | search, filter, upload | tabel mentah | tidak |
| imports | `Imports/Index` | `/admin/imports` | Import | empty | search, filter, pagination, upload, submit | tabel mentah | ya |
| imports | `ImportShow` | `/admin/imports/{import_job}` | Import | loading, empty | filter, upload, unduh, submit | tabel mentah | ya |
| imports | `ResourceIndex` | `/admin/imports/{import_job}/failed-rows` | Import | loading, empty, submitting | search, filter, pagination, bulk, upload, submit | tabel mentah | tidak |
| imports | `ImportCreate` | `/admin/imports/create` | Import | loading, empty, error | search, filter, bulk, upload, unduh | tabel mentah | ya |
| kebijakan-privasi | `CmsDocument/Edit` | `/admin/kebijakan-privasi` | Dokumen Halaman | loading, error, submitting | filter, upload | - | tidak |
| kelola | `Categories/Index` | `/admin/kelola/kategori` | Kategori | loading, empty, error, submitting | search, filter, sort, modal/drawer, submit | tabel mentah | tidak |
| kelola | `Categories/Form` | `/admin/kelola/kategori/{category}/edit` | Kategori | loading, error, submitting | search, sort | - | tidak |
| kelola | `ModelProducts/Index` | `/admin/kelola/model-produk` | Model Produk | loading, empty, submitting | search, filter, sort, upload, submit | tabel mentah | tidak |
| kelola | `ModelProducts/Form` | `/admin/kelola/model-produk/{modelProduct}/edit` | Model Produk | loading, empty, error, submitting | filter, sort, upload | tabel mentah | tidak |
| kelola | `ModelProducts/Form` | `/admin/kelola/model-produk/create` | Model Produk | loading, empty, error, submitting | filter, sort, upload | tabel mentah | tidak |
| kelola | `Products/Index` | `/admin/kelola/produk` | Produk | loading, empty | search, filter, sort, pagination, upload, unduh, submit | - | ya |
| kelola | `Products/Show` | `/admin/kelola/produk/{product}` | Produk | loading, empty, submitting | search, filter, sort, modal/drawer, upload | - | ya |
| kelola | `ProductForm` | `/admin/kelola/produk/{product}/edit` | Produk | loading, empty, error | search, filter, sort, upload, submit | tabel mentah | tidak |
| kelola | `ProductForm` | `/admin/kelola/produk/create` | Produk | loading, empty, error | search, filter, sort, upload, submit | tabel mentah | tidak |
| kelola | `Products/PopularityBoosts` | `/admin/kelola/produk/popularity-boosts` | Teruskan Popularitas | loading, empty, error, submitting | search, filter, pagination, modal/drawer, upload, submit | tabel mentah | tidak |
| kelola | `SubModels` | `/admin/kelola/sub-model` | Sub Model | loading, empty, submitting | search, filter, sort, submit | - | tidak |
| kelola | `SubModelForm` | `/admin/kelola/sub-model/{subModel}/edit` | Sub Model | loading, empty, error | search, filter | tabel mentah | tidak |
| kelola | `SubModelForm` | `/admin/kelola/sub-model/create` | Sub Model | loading, empty, error | search, filter | tabel mentah | tidak |
| ketentuan-layanan | `CmsDocument/Edit` | `/admin/ketentuan-layanan` | Dokumen Halaman | loading, error, submitting | filter, upload | - | tidak |
| masalah-solusi | `MasalahSolusi/Index` | `/admin/masalah-solusi` | Masalah & Solusi | loading, empty, submitting | search, filter, sort, submit | tabel mentah | ya |
| masalah-solusi | `MasalahSolusi/Form` | `/admin/masalah-solusi/{masalahSolusi}/edit` | Masalah & Solusi | loading, empty, error, submitting | filter, sort | - | tidak |
| masalah-solusi | `MasalahSolusi/Form` | `/admin/masalah-solusi/create` | Masalah & Solusi | loading, empty, error, submitting | filter, sort | - | tidak |
| media | `Media/Attach` | `/admin/media/{asset}/attach` | TIDAK | loading, empty, error | search, filter, submit | - | tidak |
| media | `Media/History` | `/admin/media/history` | Media Library | loading, empty | search, filter, pagination, submit | tabel mentah | tidak |
| media | `Media/Library` | `/admin/media/library` | Media Library | loading, empty | search, filter, pagination, bulk, modal/drawer, upload, submit | - | ya |
| notifications | `Notifications` | `/admin/notifications` | Notifikasi | empty | filter, submit | tabel mentah | ya |
| orders | `Orders/Index` | `/admin/orders` | Pesanan | loading, empty, error | search, filter, sort, pagination, modal/drawer, upload, unduh, submit | - | ya |
| orders | `Orders/Show` | `/admin/orders/{order}` | Pesanan | loading, empty, error, submitting | filter, sort, modal/drawer, upload, submit | - | ya |
| orders | `Payments/Index` | `/admin/orders/{order}/payments` | Pembayaran | loading, empty, error, submitting | search, filter, pagination, modal/drawer, upload, submit | tabel mentah | tidak |
| pages | `ResourceIndex` | `/admin/pages` | TIDAK | loading, empty, submitting | search, filter, pagination, bulk, upload, submit | tabel mentah | tidak |
| pages | `CmsPageForm` | `/admin/pages/{page}/edit` | TIDAK | loading, error, submitting | upload | - | tidak |
| pages | `CmsPageForm` | `/admin/pages/create` | TIDAK | loading, error, submitting | upload | - | tidak |
| payments | `Payments/Index` | `/admin/payments` | Pembayaran | loading, empty, error, submitting | search, filter, pagination, modal/drawer, upload, submit | tabel mentah | tidak |
| pengaturan-toko | `StorefrontPlatforms/Edit` | `/admin/pengaturan-toko` | Profil & Kontak Toko | loading, empty, error | filter, upload, submit | tabel mentah | ya |
| profile | `Profile/Edit` | `/admin/profile` | Profil Saya | loading, error, submitting | upload | - | tidak |
| promotions | `Promotions` | `/admin/promotions` | Promo Toko | loading, empty, error | search, filter, upload, submit | - | ya |
| promotions | `PromotionDetail` | `/admin/promotions/{promotion}` | Promo Toko | empty | - | - | ya |
| promotions | `PromotionForm` | `/admin/promotions/{promotion}/edit` | Promo Toko | loading, empty, error, flash | filter, modal/drawer, upload | - | tidak |
| promotions | `PromotionForm` | `/admin/promotions/create` | Promo Toko | loading, empty, error, flash | filter, modal/drawer, upload | - | tidak |
| promotions | `Vouchers/Index` | `/admin/promotions/vouchers` | Promo Toko | loading, empty | search, pagination, upload, submit | tabel mentah | ya |
| promotions | `Vouchers/Form` | `/admin/promotions/vouchers/{voucher}/edit` | Promo Toko | loading, error, submitting | - | tabel mentah | tidak |
| promotions | `Vouchers/Form` | `/admin/promotions/vouchers/create` | Promo Toko | loading, error, submitting | - | tabel mentah | tidak |
| settings | `SystemHealth` | `/admin/settings` | Pengaturan Sistem | loading | search, filter, upload, submit | - | ya |
| shipping | `Shipping/Index` | `/admin/shipping` | Pengiriman | empty | search, filter, pagination, submit | tabel mentah | ya |
| shipping | `ResourceShow` | `/admin/shipping/{shipping}` | Pengiriman | loading, empty, submitting | upload, submit | - | tidak |
| shipping-subsidy | `ShippingSubsidy/Edit` | `/admin/shipping-subsidy` | Subsidi Ongkir | loading, error, submitting | - | tabel mentah | ya |
| storefront-platforms | `StorefrontPlatforms/Edit` | `/admin/storefront-platforms` | Profil & Kontak Toko | loading, empty, error | filter, upload, submit | tabel mentah | ya |
| tentang-kami | `TentangKami/Edit` | `/admin/tentang-kami` | Tentang Kami | loading, empty, error, submitting | filter, modal/drawer, upload | - | ya |
| testimonials | `Testimonials/Form` | `/admin/testimonials/{testimonial}/edit` | Ulasan | loading, error | filter, sort, upload, submit | - | tidak |
| testimonials | `Testimonials/Form` | `/admin/testimonials/create` | Ulasan | loading, error | filter, sort, upload, submit | - | tidak |
| users | `Users/Index` | `/admin/users` | Manajemen Admin | loading, empty | search, filter, sort, pagination, upload, submit | tabel mentah | ya |
| users | `Users/Form` | `/admin/users/{user}/edit` | Manajemen Admin | loading, error, submitting | - | tabel mentah | tidak |
| users | `Users/Form` | `/admin/users/create` | Manajemen Admin | loading, error, submitting | - | tabel mentah | tidak |
| whatsapp | `WhatsApp/Hub` | `/admin/whatsapp` | WhatsApp | empty | submit | tabel mentah | tidak |
| whatsapp | `WhatsApp/Pairing` | `/admin/whatsapp/pairing` | WhatsApp | flash | - | - | tidak |
| whatsapp | `WhatsApp/Index` | `/admin/whatsapp/templates` | WhatsApp | empty | submit | - | tidak |
| whatsapp | `WhatsApp/Edit` | `/admin/whatsapp/templates/{template}/edit` | WhatsApp | loading, error, submitting | - | - | tidak |
