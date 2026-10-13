# Review Admin — Lensa Design Thinking (X → Graph → Effect<A,E,R>)

Tanggal: 2026-08-22
Lensa: docs/design_thinking.md (§1-10 + Pipeline + E scoping per layer + divergent strategies).
Ref: docs/audit-admin-vs-spek.md (temuan fungsional). Focus review lanjutan di sini: **struktur graph & Error handling** pada temuan prioritas.

## Prinsip lensa yang dipakai
- Kode HARUS = call graph. A (happy path) vs E (error) terpisah struktural.
- E d-scope per layer (Services→Auth→Handlers), tiap layer enum E yang DITERIMANYA.
- Divergent strategy = 2 efek beda tracing dlm 1 gen body → handle inline, tandai jelas, JARANG.
- "If the code doesn't match the call graph, the implementation is wrong."

## Temuan struktural

### 1. `OrderController::updateStatus` — SATU gen body monster, E tercampur ⚠️
- Lokasi: `OrderController:758-860`.
- Menangani SEMUA status dlm satu method: validasi → rantai if/elseif (return_in_process, cancelled, transfer, cod, return_completed) → `match` pesan → `if/elseif` WA → `try/transition`.
- **Masalah vs §4/§10:**
  - E (error) tercampur: `canTransition` guard, `DomainException` (transition), `completeCodAtCompletion`, `sendTemplateMessage` semua di 1 layer → E dari node berbeda tidak dibedakan.
  - Divergent strategies (WA: order_issue vs order_returned vs cod) memakai if/elseif di akhir, bukan di per-node.
  - Happy path sulit dibaca (A tidak murni — diselip tengah rantai).
- **Dampak nyata (data integrity):** `return_completed` bisa dicapai lewat `updateStatus` TANPA menulis ledger `returned_quantity`.

### 2. DIVERGENT STRATEGY BUG — dua pintu ke `return_completed` 🔴
- **Jalur benar:** UI form retur (`Show.tsx:530`) → `POST admin.orders.returns.complete` → `OrderController::completeReturn:688-753` → menulis `returned_items[].returned_quantity` (ledger) → `transition(return_completed)`.
- **Jalur bypass:** `primaryActionFor` (`OrderController:1050-1052`) tombol **"Selesaikan Retur"** `kind=advance_status` → `updateStatus` → `transition(return_completed)` (dizinkan `OrderStateMachine.php:20` return_in_process→return_completed) — **TANPA** menyentuh ledger.
- **Konsekuensi:** Performa Toko menghitung retur dari **ledger** (`StorePerformanceService:270-286`: `returned_quantity > 0`, `completed_at`). Kalau admin pakai tombol cepat, retur TIDAK terhitung → **omzet/net salah** (refund tidak diturunkan). Ini impact lintas menu (Order + Performa Toko).
- **Root cause (lensa):** dua cabang beda E semantic sharing satu node final tanpa tanda divergent strategy → graph punya fork yang tidak dikenali.
- **Fix arah:** hapus `'return_completed'` dari jalur admin `updateStatus` (block di function + out dari `primaryActionFor`), paksa lewat `completeReturn`. Persis spt `return_in_process` sudah di-block di `updateStatus:771-774`.

### 3. `updateStatus` memungkinkan `shipped→delivered` (Tandai Sampai) — deviasi spec
- `OrderStateMachine.php:17`: `'shipped' => ['delivered', 'issue']` — admin bisa set delivered manual.
- Spec 05/06: Sampai harus dari tracking terverifikasi, no manual delivered.
- **Lensa:** shipped→delivered adalah transisi E-sensitive (hanya carrier boleh). Karena source admin & carrier campur di `canTransition(order, to, 'admin')`, boundary source tidak tegas → E dari carrier mencemari jalur admin.
- **Fix arah:** pisahkan izin admin vs carrier utk transisi `delivered` (carrier-only), atau `Tandai Sampai` hanya via cascade terverifikasi (sudah ada `ShippingService::cascadeOrderStatus`).

### 4. E scoping — Payment & PaymentService sudah lebih baik
- `PaymentService::markCompleted/completeCodAtCompletion` membungkus E domain (constraint), controller tangkap `DomainException`. Cukup clean utk layer service.
- `completeCodAtCompletion` (PaymentService) dipanggil `OrderController:840` — COD settle ter-isolasi dari status admin. ✓

## Rekomendasi prioritas (urutan dampak)
1. **P0** — Tutup jalur bypass `return_completed` di `updateStatus` + `primaryActionFor` (inkl. `return_in_process` guard). Ini satu-satunya yang merusak data omzet retur.
2. **P1** — Batasi `shipped→delivered` hanya via carrier/cascade (Tandai Sampai manual dihapus).
3. **P1** — UI Pembayaran: tampilkan `evidence_url` (bukti transfer).
4. **P2** — Refactor `updateStatus` jadi per-status handler kecil (A/E terpisah) — mengikuti graph lensa.

## Verifikasi / pengujian usulan
- Test: return_completed VIA button cepat → ledger tetap 0 / diblok dengan pesan "Retur wajib via form".
- Test: Performa Toko retur KPIs konsisten (return_orders & return_value) setelah selesaikan retur via form.
- Test: shipped tidak bisa jadi delivered via tombol admin; tetap lewat cascade J&T.