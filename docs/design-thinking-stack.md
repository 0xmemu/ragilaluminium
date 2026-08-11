# Design Thinking — Adaptasi Laravel + Inertia + React

> Adaptasi dari `docs/design_thinking.md` (filosofi X → Graph → Effect\<A,E,R\>) ke stack
> project ini: **Laravel (PHP) backend + Inertia + React (TypeScript) frontend**.
> Project ini tidak memakai Effect-TS; A/E/R di sini berarti **data flow / error handling /
> dependencies**, diterjemahkan ke idiom Laravel & React yang nyata di codebase.

```
Problem → Graph (alur data) → Kode
   │          │
   │          └─ nodes = method/fungsi, edges = pemanggilan & data yang lewat
   └─ apa yang mau dibangun: pesanan, katalog, WA automation, dsb.
```

- §1 Shape: record, ID, status/state, error
- §2 A (happy path) dulu: alur sukses sebagai call graph
- §3 Sekali (request) atau berulang (event/queue)
- §4 E (break points): retry / fallback / die
- §5 R (dependencies): constructor injection, contract
- §6 Boundary: FormRequest + validated() = trust boundary
- §7 Behavior: middleware, event listener, tanpa mengubah inti
- §8 Resource: DB transaction, file, koneksi WA
- §9 Test: swap R dengan fake, graph sama
- §10 A dan E terpisah secara struktur

> Baca masalahnya. Gambar alur datanya sebagai call graph. Tulis kode yang SESUAI graph-nya.
> Kalau kode tidak cocok dengan graph, ada yang salah.

---

## 1. Name the shapes

Apa saja "benda"-nya? Definisikan dulu bahasa domain sebelum menggambar graph.

- **Record** — entitas yang mengalir lewat node. Di sini: `Order`, `Product`, `CartItem`,
  `Customer`, `WhatsAppMessage`. Dalam PHP: Eloquent model. Dalam React: `InertiaPageProps`
  yang di-`shared` atau props per halaman.
- **ID** — identitas. `parent_sku` (produk), `checkout_idempotency_key` (UUID pesanan —
  mencegah double-submit), `order_number` (nomor unik yang di-retry saat duplikat).
- **State/status** — transisi state internal. `Order::status`: `pending → confirmed →
  processing → shipped → delivered` (dan `cancelled`/`returned`). Ada `canTransition()`
  yang menegakkan mesin state — ini "variants" di dokumen asli.
- **Error** — mode kegagalan yang bernama, bukan string acak. Di sini `DomainException`
  dengan pesan user-facing ("Keranjang kosong...", "Token checkout tidak valid..."),
  ditangkap controller → dikirim ke React sebagai `flash.error` / `errors`.

Noun dulu, baru verb. Tidak bisa menggambar graph sebelum tahu apa yang mengalir.

## 2. Think A first (happy path)

Gambar alur sukses sebagai call graph SEBELUM menulis kode.

Contoh nyata: **checkout → pesanan → konfirmasi WA**

```
CheckoutController::placeOrder (validasi)
  → OrderService::createFromCart  (inti bisnis, dalam DB::transaction)
  → OrderCreated event
    → WhatsAppService::handleOrderCreated (kirim WA konfirmasi)
  → redirect ke halaman OrderConfirmation
```

Setiap node punya input & output yang jelas:

```
PlaceOrderRequest (validated)  →  Order  →  flash sukses + redirect
```

Graph ini ADALAH struktur program. Gambar dulu; kode mengikuti.

## 3. One or many? (cardinality)

Apakah node berjalan sekali atau mengalir?

- **Sekali (request/response)** — `placeOrder`, `CartController::add`, `SearchController::index`.
  Ini mayoritas di Laravel: satu request, satu response.
- **Berulang / asynchronous (event, queue, webhook)** — `OrderCreated` event → listener
  WhatsApp; `PaymentConfirmed` → `notifyOrderProcessing`; webhook Meta/Baileys datang
  kapan saja. Di sini graph-nya punya "ujung" yang menunggu kejadian, bukan panggilan langsung.
- **Time-bounded (cache)** — hasil valid sebentar: katalog, harga, tarif ongkir.
  Cache di Redis/memcached, dedupe lookup konkuren.

Tandai cardinality di graph supaya kode cocok: kalau node "kirim WA" harusnya async tapi
dipanggil sinkron di tengah transaction, itu bug desain — blokir dan gagal diam-diam.

## 4. Think E second (break points)

Tandai di mana graph bisa putus. Tiap titik putus adalah salah satu dari tiga:

- **Retry** — gagal sementara, coba lagi. Contoh nyata di codebase:
  `createWithRetryOnDuplicateNumber` — retry bikin `order_number` kalau tabrakan nomor unik;
  nomor order duplikat → coba nomor berikutnya, bukan error fatal.
- **Escape / fallback** — bisa pulih, beri alternatif. Contoh: WA gagal terkirim →
  `sendTemplateMessage` mengembalikan `?WhatsAppMessage` (null = gagal, pesanan tetap jalan);
  produk tidak aktif saat checkout → `DomainException` bernama → flash error → user kembali
  ke keranjang. Search kosong → fallback "ukuran terdekat / kategori terkait".
- **Die** — defect, invariant dilanggar, bug programmer. BUKAN domain error.
  Contoh: `checkout_idempotency_key` bukan UUID → `DomainException` "Token checkout tidak
  valid"; order state transition ilegal → tolak.

Error adalah NILAI yang mengalir sampai benar-benar tidak bisa ditangani. Di setiap node
kamu putuskan: retry, fallback, atau biarkan propagasi. "Die" hanya saat asumsi program
dilanggar.

## 5. Think R third (dependencies)

Tandai apa yang dibutuhkan tiap node agar bisa eksis. "Kita tidak bisa X tanpa Y."

- **Laravel**: constructor injection di service — `OrderService` butuh `CartService`;
  `WhatsAppService` butuh `OrderService`. Laravel container menyediakan otomatis.
  Kalau dependency tidak ada → error jelas saat instantiate, bukan runtime misterius.
- **Abstraksi di belakang service**: `ShippingService` membungkus `JntCargoClient` —
  backend ongkir bisa diganti/di-upgrade (dari mode test ke API asli) tanpa mengubah
  graph checkout. Klien eksternal (JNT, WA, R2) sebaiknya selalu dibungkus service agar
  R tidak bocor ke controller.
- **React**: props & hooks adalah R. `CheckoutPage` butuh `cart`, `shippingOptions`,
  `paymentMethods` (dikirim controller via Inertia). Kalau prop hilang → TypeScript error
  saat kompilasi, bukan render kosong.

R menyusut saat lapisan disediakan. Saat R tidak kosong, compiler/container memberi tahu
persis apa yang kurang.

## 6. Trust at boundary (validasi di tepi)

Di mana data tak tepercaya masuk graph? HTTP request, webhook, env, input user,
response API pihak ketiga.

- **Laravel**: `FormRequest` + `validated()` adalah "Schema" project ini.
  `PlaceOrderRequest::rules()` (`payment_method => in:cod,transfer`, dll.) —
  satu definisi = aturan + filter + transform. Controller HANYA menerima `$request->validated()`.
- **React**: props Inertia sudah di-shape backend; form pakai state lokal + `form.errors`
  dari server. Client-side validation hanya untuk UX, bukan trust boundary.
- **Webhook** (Meta/Baileys): payload tak tepercaya → di-validasi/verifikasi signature
  di boundary, baru jadi event internal.

Tidak percaya apa pun di tepi. Percaya semua di dalam. Boundary satu-satunya tempat parse.

## 7. Layer behavior (tanpa mengubah inti)

Concern lintas potong yang membungkus node: retry, timeout, logging, cache.

- **Laravel**: `DB::transaction` membungkus `createFromCart` tanpa mengubah logika inti;
  event/listener memisahkan efek samping (WA) dari graph utama; middleware (auth, session)
  membungkus request. Logging via ActivityLogService terpisah dari flow.
- **React**: layout & shared components membungkus halaman; `flash` message di render,
  bukan di logika bisnis.

Graph bilang APA yang terjadi. Lapisan bilang BAGAIMANA perilakunya saat tekanan.

## 8. Scope resources

Node mana yang mengambil resource? Koneksi DB, file, koneksi WebSocket/WA, child process.

- **DB transaction** (`DB::transaction`) — commit atau rollback otomatis; kalau `DomainException`
  dilempar di tengah, seluruh batch batal — cleanup struktural, bukan `catch` yang dilupakan.
- **Koneksi WhatsApp** — webhook-driven; kalau koneksi putus, `connectionStatus()` memberi
  status, queue menahan pesan; tidak ada file handle yang bocor.
- **Upload media** (R2) — resource eksternal; gagal upload → error bernama, bukan state korup.

Cleanup adalah jaminan struktur, bukan komentar TODO.

## 9. Swap R to prove it (test)

Call graph tidak berubah antara produksi dan test. Hanya R yang berubah.

- **Graph sama**: `OrderService::createFromCart` tetap memanggil node yang sama di test.
- **R berbeda**: pakai `Fake` untuk `WhatsAppService`, `Shipping`, `CartService` —
  order dibuat tanpa WA betulan; shipping provider dummy mengembalikan tarif tetap.
- **Cek**: kalau graph tidak bisa jalan dengan R test, desain punya hidden dependency.
  Kalau harus mock seluruh dunia untuk test satu node, node itu melakukan terlalu banyak.

Ini payoff pemisahan A/E/R: buktikan graph benar dengan menukar yang ada di belakang R.

## 10. A dan E terpisah secara struktur

Pemisahan A (happy path) dan E (error) harus terlihat di struktur kode:

- **`createFromCart`**: body utamanya alur sukses murni — validasi idempotensi, ambil
  keranjang, hitung subtotal, buat Order, dispatch event. Error domain (`DomainException`)
  dilempar ke atas, TIDAK ditangani di dalam — controller yang menangkap dan menerjemahkan
  ke flash/errors untuk React.
- **`.pipe()`-nya di sini = controller**: `catch (DomainException $e)` → `redirect()->back()
  ->withErrors(...)`; `ValidationException` otomatis → `form.errors`. Error enumeration
  lengkap di lapisan controller, bukan berserakan di service.

Kalau error handling tinggal di dalam body service, path A dan E kusut — kamu tidak bisa
membaca happy path tanpa menyelami try/catch. Body = graph A. Controller/listener = anotasi E.

## E scoping per layer

Tiap lapisan graph men-scope E-nya sendiri sebelum diteruskan:

```
Controller → Service → Repository/Model
E=Validation  E=Domain  E=DB/query
   ↓ scope      ↓ scope
DomainException DBException
```

- Controller menangkap `ValidationException` (dari FormRequest) → `form.errors`.
- Service melempar `DomainException` (bisnis) → controller → flash error.
- Model/query error (`QueryException`, dsb.) → tidak pernah sampai ke user mentah;
  direkam log, diterjemahkan jadi pesan generik.

Konsumen tidak pernah melihat error implementasi dari lapisan lebih dalam.

## Divergent strategies

Saat dua operasi di node yang sama butuh penanganan E berbeda — satu harus gagal keras,
satunya fallback halus — itu divergent strategy. Tangani E masing-masing di tempatnya,
karena pemanggil luar tidak bisa membedakan yield mana yang error.

Contoh nyata: dalam satu `placeOrder`, `createFromCart` HARUS gagal total kalau produk
tidak tersedia (die/escape keras → user kembali ke keranjang), tapi `sendTemplateMessage`
harus fallback diam-diam kalau WA gagal (pesanan tetap terbuat). Dua semantik beda di
graph yang sama — tangani dekat titiknya, tandai jelas, dan ini harus jarang.

## The Pipeline (checklist sebelum menulis kode)

```
MASALAH
→ "Apa shapes-nya?" → definisikan bahasa domain (model, ID, status, error)
→ "Apa happy path-nya?" → gambar call graph (A)
→ "Sekali atau berulang?" → tandai cardinality (request vs event/queue)
→ "Di mana bisa putus?" → anotasi error di graph (E): retry / fallback / die
→ "Apa yang dibutuhkan tiap node?" → anotasi dependency (R): injection, contract, props
→ "Di mana data tak tepercaya masuk?" → FormRequest + validated() di boundary
→ "Apa yang membungkus node tanpa mengubahnya?" → transaction, event, middleware
→ "Resource apa yang perlu dibersihkan?" → scope lifecycle (DB transaction, koneksi)
→ "Graph jalan dengan R test?" → verifikasi dengan fake layer
→ "Apakah A dan E terpisah struktural?" → service = A, controller/listener = E
→ KODE → kode itu ADALAH graph
```

Jika kode tidak cocok dengan call graph, implementasinya salah.
