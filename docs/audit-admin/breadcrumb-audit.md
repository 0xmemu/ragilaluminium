# Audit breadcrumb admin (port resolveAdminBreadcrumb)

290 nama route admin diuji dengan port logika resolusi yang sama seperti source.

## Anomali: route yang cocok ke lebih dari satu item menu, atau label berulang

| Route | Breadcrumb yang dihasilkan | Item menu yang cocok |
|---|---|---|
| `admin.dashboard` | Beranda / Beranda | 1 |
| `admin.products.index` | Beranda / Produk / Produk | 1 |
| `admin.products.create` | Beranda / Produk / Produk | 1 |
| `admin.products.export` | Beranda / Produk / Produk | 1 |
| `admin.products.show` | Beranda / Produk / Produk | 1 |
| `admin.products.attributes.index` | Beranda / Produk / Produk | 1 |
| `admin.products.edit` | Beranda / Produk / Produk | 1 |
| `admin.products.media.byProduct` | Beranda / Produk / Produk | 1 |
| `admin.products.variants.index` | Beranda / Produk / Produk | 1 |
| `admin.shipping-subsidy.edit` | Beranda / Pengiriman / Harga & Promo / Subsidi Ongkir | 2 |
| `admin.products.store` | Beranda / Produk / Produk | 1 |
| `admin.products.update` | Beranda / Produk / Produk | 1 |
| `admin.products.archive` | Beranda / Produk / Produk | 1 |
| `admin.products.attributes.store` | Beranda / Produk / Produk | 1 |
| `admin.products.duplicate` | Beranda / Produk / Produk | 1 |
| `admin.products.media.store` | Beranda / Produk / Produk | 1 |
| `admin.products.media.bulk` | Beranda / Produk / Produk | 1 |
| `admin.products.publish` | Beranda / Produk / Produk | 1 |
| `admin.products.unarchive` | Beranda / Produk / Produk | 1 |
| `admin.products.variants.store` | Beranda / Produk / Produk | 1 |
| `admin.products.variants.bulk` | Beranda / Produk / Produk | 1 |
| `admin.shipping-subsidy.update` | Beranda / Pengiriman / Harga & Promo / Subsidi Ongkir | 2 |
