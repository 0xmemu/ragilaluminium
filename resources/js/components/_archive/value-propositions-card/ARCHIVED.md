# Arsip: ValuePropositionsCard

**Status:** DIARSIPKAN — user kurang cocok (2026-08-22). Kemungkinan dipakai lagi nanti.

## Asal
- Komponen: `value-propositions-card.tsx` (4 kolom: Konsultasi Gratis · Catatan Produk · Garansi 100% · Packing Aman)
- Dibuat di commit `6980926` (checkout) & `89aea9e` (cart), dari mockup SVG user (kartu 4 kolom ikon+label+desc).

## Cara re-activate
1. Pindah `value-propositions-card.tsx` kembali ke `resources/js/components/public/`
2. Di `resources/js/pages/Public/Checkout.tsx`: tambah import + `<ValuePropositionsCard />` setelah `<CheckoutPaymentSection ... />` (kolom kiri)
3. Di `resources/js/pages/Public/Cart.tsx`: tambah import + `<ValuePropositionsCard className="mt-3" />` setelah `<TrustAssuranceCard />`
4. `npm run build`

## Catatan
- Ikon dipakai: `headset`, `pencil-simple`, `shield-check`, `box` (semua ada di registry Icon)
- Teks bisa disesuaikan (4 value proposition bebas)
- Alternatif yang dipakai sekarang: `TrustAssuranceCard` (1 kolom "Belanja Aman & Terpercaya")
