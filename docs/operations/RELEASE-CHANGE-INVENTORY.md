# Inventaris perubahan kandidat rilis, 13 Oktober 2026

Inventaris read-only atas 206 entri status pada branch `feat/admin-ui-redesign` di VPS kerja 209, commit `08a91fb2`. Dua snapshot pada 06:25 dan 06:33 UTC menunjukkan hash status, diff, dan berkas tidak dilacak identik; tidak ada proses penulis atau kunci Git yang terdeteksi. Ini bukti aktivitas berhenti selama pengamatan singkat, bukan bukti pekerjaan telah selesai.

Klasifikasi di bawah berdasarkan fungsi dan letak berkas, **bukan** otorisasi untuk commit atau menghapus. Asal dan pemilik setiap perubahan belum dibuktikan. Status `M` berarti berubah, `D` berarti terhapus dari working tree, `??` berarti belum dilacak Git.

| Kelompok | Jumlah | Catatan |
|---|---:|---|
| Fitur dan kode | 111 | Termasuk 16 berkas baru dan 4 migrasi database yang belum dilacak; wajib tinjau dependensi dan kontrak sebelum commit. |
| Pengujian | 77 | Perubahan dan berkas test; belum dijalankan sebagai satu kandidat rilis. |
| Dokumentasi | 12 | Termasuk catatan kolaborasi yang kotor, jangan ikutkan perubahan agent lain. |
| Kandidat sementara | 6 | Empat skrip patch, satu arsip CTA, satu test `.bak`; dipertahankan sampai fungsi dan pemilik diverifikasi. |
| Belum diketahui berdasarkan lokasi | 0 | Kategori file dapat ditentukan, tetapi asal, pemilik, dan kelengkapan banyak perubahan tetap belum diketahui. |

**Batas rilis saat inventaris awal:** spasi akhir pada `resources/js/components/shared/shipping-track-panel.tsx:132` telah dibetulkan dan `git diff --check` kini lulus. Empat migrasi belum dilacak sementara dokumen skema kanonik tidak berubah; jangan mengasumsikan spesifikasi telah lengkap. VPS 202 masih NO-GO menurut `PRODUCTION-READINESS-REPORT.md`. Tidak ada build penuh, commit, pembersihan, merge, tag, atau deploy selama inventaris ini.

## Daftar lengkap menurut kategori

### Fitur dan kode (111)

- ` M` `app/Http/Controllers/Admin/ApaKataController.php`
- ` D` `app/Http/Controllers/Admin/CtaSettingsController.php`
- ` M` `app/Http/Controllers/Admin/GalleryItemController.php`
- ` M` `app/Http/Controllers/Admin/KebijakanPrivasiController.php`
- ` M` `app/Http/Controllers/Admin/KetentuanLayananController.php`
- ` M` `app/Http/Controllers/Admin/MediaPickerController.php`
- ` M` `app/Http/Controllers/Admin/PromotionController.php`
- ` M` `app/Http/Controllers/Admin/TentangKamiController.php`
- ` M` `app/Http/Controllers/ProductController.php`
- ` M` `app/Models/CmsModelProduct.php`
- ` M` `app/Models/Product.php`
- ` M` `app/Models/SubModel.php`
- ` M` `app/Services/CampaignService.php`
- ` M` `app/Services/MediaAssetResolver.php`
- ` M` `app/Services/PriceService.php`
- ` M` `app/Services/ProductEngagementService.php`
- ` M` `app/Services/ProductPopularityService.php`
- ` M` `app/Services/StorePerformanceService.php`
- ` M` `app/Support/AboutPageSettings.php`
- ` M` `app/Support/BankTransferInstructions.php`
- ` M` `app/Support/ConsultationWhatsApp.php`
- ` D` `app/Support/CtaSettings.php`
- ` M` `app/Support/InertiaCatalog.php`
- ` M` `app/Support/OperationalSettings.php`
- ` M` `app/Support/StoreContactSettings.php`
- ` M` `app/Support/UpdatePreviewDiff.php`
- ` M` `app/Support/WhatsAppAutomationCatalog.php`
- ` M` `database/seeders/WhatsAppTemplateSeeder.php`
- ` M` `eslint.config.js`
- ` M` `resources/css/app.css`
- ` M` `resources/js/components/admin/charts/sales-area-chart.tsx`
- ` D` `resources/js/components/admin/manage-promotions-tabs.tsx`
- ` M` `resources/js/components/admin/option-menu.tsx`
- ` M` `resources/js/components/admin/product-edit/media-panel.tsx`
- ` M` `resources/js/components/admin/product-edit/variant-panel.tsx`
- ` M` `resources/js/components/admin/reorder-drag-handle.tsx`
- ` M` `resources/js/components/admin/resource-value.tsx`
- ` M` `resources/js/components/admin/row-actions.tsx`
- ` M` `resources/js/components/admin/ui/status-badge.tsx`
- ` M` `resources/js/components/admin/ui/switch.tsx`
- ` M` `resources/js/components/public/cart-checkout-summary.tsx`
- ` M` `resources/js/components/public/cart-line-item.tsx`
- ` M` `resources/js/components/public/catalog-listing-sidebar.tsx`
- ` M` `resources/js/components/public/closing-cta.tsx`
- ` M` `resources/js/components/public/flash-sale-stage.tsx`
- ` M` `resources/js/components/public/gallery-lightbox.tsx`
- ` M` `resources/js/components/public/help-page-frame.tsx`
- ` M` `resources/js/components/public/home-carousels.tsx`
- ` M` `resources/js/components/public/home-hero.tsx`
- ` M` `resources/js/components/public/home-sections.tsx`
- ` M` `resources/js/components/public/page-top-bar.tsx`
- ` M` `resources/js/components/public/product-buy-box.tsx`
- ` M` `resources/js/components/public/product-card.tsx`
- ` M` `resources/js/components/public/product-gallery.tsx`
- ` M` `resources/js/components/public/product-listing-frame.tsx`
- ` M` `resources/js/components/public/product-related-section.tsx`
- ` M` `resources/js/components/public/review-listing-frame.tsx`
- ` M` `resources/js/components/public/trust-assurance-card.tsx`
- ` M` `resources/js/components/shared/shipping-track-panel.tsx`
- ` M` `resources/js/components/ui/breadcrumbs.tsx`
- ` M` `resources/js/components/ui/pagination.tsx`
- ` M` `resources/js/hooks/use-row-drag-sort.ts`
- ` M` `resources/js/lib/capabilities.ts`
- ` M` `resources/js/lib/cta-actions.ts`
- ` D` `resources/js/lib/cta-live.json`
- ` M` `resources/js/lib/order-eta-display.ts`
- ` M` `resources/js/lib/status.ts`
- ` M` `resources/js/pages/Admin/ApaKata/Index.tsx`
- ` M` `resources/js/pages/Admin/CaraPemesanan/Edit.tsx`
- ` M` `resources/js/pages/Admin/Categories/Form.tsx`
- ` M` `resources/js/pages/Admin/CmsDocument/Edit.tsx`
- ` M` `resources/js/pages/Admin/CmsPageForm.tsx`
- ` D` `resources/js/pages/Admin/CtaStorefront/Edit.tsx`
- ` M` `resources/js/pages/Admin/Documents/Index.tsx`
- ` M` `resources/js/pages/Admin/Faq/Index.tsx`
- ` M` `resources/js/pages/Admin/Imports/Index.tsx`
- ` M` `resources/js/pages/Admin/InstallationGallery/Index.tsx`
- ` M` `resources/js/pages/Admin/MasalahSolusi/Index.tsx`
- ` M` `resources/js/pages/Admin/ModelProducts/Index.tsx`
- ` M` `resources/js/pages/Admin/Products/Show.tsx`
- ` M` `resources/js/pages/Admin/Profile/Edit.tsx`
- ` M` `resources/js/pages/Admin/Promotions.tsx`
- ` M` `resources/js/pages/Admin/TentangKami/Edit.tsx`
- ` M` `resources/js/pages/Admin/Users/Index.tsx`
- ` M` `resources/js/pages/Public/About.tsx`
- ` M` `resources/js/pages/Public/Catalog.tsx`
- ` M` `resources/js/pages/Public/Faq.tsx`
- ` M` `resources/js/pages/Public/Home.tsx`
- ` M` `resources/js/pages/Public/HowToOrder.tsx`
- ` M` `resources/js/pages/Public/Installations.tsx`
- ` M` `resources/js/pages/Public/ModelDetail.tsx`
- ` M` `resources/js/pages/Public/ModelProduk.tsx`
- ` M` `resources/js/pages/Public/OrderConfirmation.tsx`
- ` M` `resources/js/pages/Public/ProductDetail.tsx`
- ` M` `resources/js/types/index.ts`
- `??` `app/Console/Commands/EvaluatePopularityThresholds.php`
- `??` `app/Services/PromotionOverviewService.php`
- `??` `app/Support/BankTransferSettings.php`
- `??` `app/Support/WhatsAppMessageDrafts.php`
- `??` `app/Support/WhatsAppSessionPhone.php`
- `??` `app/Support/WhatsAppTemplateSync.php`
- `??` `database/migrations/2026_09_15_120000_add_media_to_cms_model_products_table.php`
- `??` `database/migrations/2026_09_15_130000_add_media_settings_to_cms_model_products_table.php`
- `??` `database/migrations/2026_09_16_000100_drop_image_url_from_sub_models_table.php`
- `??` `database/migrations/2026_09_17_010000_add_homepage_popular_since_to_products_table.php`
- `??` `resources/js/components/admin/media-library-select.tsx`
- `??` `resources/js/hooks/use-media-zoom.ts`
- `??` `resources/js/lib/breadcrumb-back.ts`
- `??` `resources/js/lib/cta-content.ts`
- `??` `resources/js/lib/media-zoom.ts`
- `??` `resources/js/lib/pagination.ts`

### Pengujian (77)

- ` M` `tests/Concerns/CreatesVisibleProducts.php`
- ` M` `tests/Feature/AdminProductListSortTest.php`
- ` M` `tests/Feature/AdminProductMediaVariantTest.php`
- ` M` `tests/Feature/AdminProductWizardTest.php`
- ` M` `tests/Feature/AttributeTemplateTest.php`
- ` M` `tests/Feature/CartPromoPricingTest.php`
- ` M` `tests/Feature/CatalogCardLinkContractTest.php`
- ` M` `tests/Feature/CatalogDynamicCategoryTest.php`
- ` M` `tests/Feature/CatalogRuntimeSchemaTest.php`
- ` M` `tests/Feature/CatalogSearchBoundaryTest.php`
- ` M` `tests/Feature/CatalogSearchTest.php`
- ` M` `tests/Feature/CheckoutCartRemainderTest.php`
- ` M` `tests/Feature/CodSettingsTest.php`
- ` M` `tests/Feature/ColorSpellingSearchTest.php`
- ` M` `tests/Feature/CommerceWorkflowTest.php`
- ` D` `tests/Feature/CtaStorefrontTest.php`
- ` M` `tests/Feature/CustomerReviewTest.php`
- ` M` `tests/Feature/FlashSalePeriodTest.php`
- ` M` `tests/Feature/ImportPipelineTest.php`
- ` M` `tests/Feature/ImportStoreUploadTest.php`
- ` M` `tests/Feature/KebijakanPrivasiAdminTest.php`
- ` M` `tests/Feature/KetentuanLayananAdminTest.php`
- ` M` `tests/Feature/MediaDerivativesTest.php`
- ` M` `tests/Feature/MediaPickerEndpointTest.php`
- ` M` `tests/Feature/OrderConfirmationTest.php`
- ` M` `tests/Feature/OrderNumberTest.php`
- ` M` `tests/Feature/OrderStateMachineTest.php`
- ` M` `tests/Feature/Phase11AdminMediaReviewGuardTest.php`
- ` M` `tests/Feature/PricePromoOrderContractTest.php`
- ` M` `tests/Feature/ProductCacheTest.php`
- ` M` `tests/Feature/ProductEngagementContractTest.php`
- ` M` `tests/Feature/ProductEngagementQueueTest.php`
- ` M` `tests/Feature/ProductEngagementTest.php`
- ` M` `tests/Feature/ProductPopularityBoostTest.php`
- ` M` `tests/Feature/ProductPriceLogTest.php`
- ` M` `tests/Feature/ProductReviewsTest.php`
- ` M` `tests/Feature/ProductVariantGalleryTest.php`
- ` M` `tests/Feature/ProductWithoutSubModelTest.php`
- ` M` `tests/Feature/QueueRetrySemanticsTest.php`
- ` M` `tests/Feature/ReviewReplyEntryPointsTest.php`
- ` M` `tests/Feature/ReviewsRatingFilterTest.php`
- ` M` `tests/Feature/SharedMediaAssetTest.php`
- ` M` `tests/Feature/SitemapTest.php`
- ` M` `tests/Feature/StockMovementTest.php`
- ` M` `tests/Feature/StockReservationTest.php`
- ` M` `tests/Feature/StorePerformanceChartAlignmentTest.php`
- ` M` `tests/Feature/StorePerformanceContractTest.php`
- ` M` `tests/Feature/StorePerformanceF10RulesTest.php`
- ` M` `tests/Feature/StorePerformanceHistoryTest.php`
- ` M` `tests/Feature/StorePerformancePeriodeSnapshotTest.php`
- ` M` `tests/Feature/StorePerformanceRefusedCostTest.php`
- ` M` `tests/Feature/StorePerformanceRefusedReturnTest.php`
- ` M` `tests/Feature/StorePerformanceTask1Test.php`
- ` M` `tests/Feature/StorePerformanceTask2Test.php`
- ` M` `tests/Feature/StorePerformanceTask3Test.php`
- ` M` `tests/Feature/StorePerformanceTest.php`
- ` M` `tests/Feature/StorePerformanceTrendCoverageTest.php`
- ` M` `tests/Feature/TentangKamiAdminTest.php`
- ` M` `tests/Feature/TestimonialReplyTest.php`
- ` M` `tests/Feature/TransactionIntegrityTest.php`
- ` M` `tests/Feature/WhatsAppAutomationTest.php`
- ` M` `tests/Feature/WorkflowAuditP1Test.php`
- ` M` `tests/Feature/WorkflowAuditP2Test.php`
- ` M` `tests/Feature/archive/ShopeeMediaSyncTest.php`
- ` M` `tests/Unit/ShopeeStyleSkuTest.php`
- ` M` `tests/frontend/admin-edit-guard.test.ts`
- ` M` `tests/frontend/status.test.ts`
- `??` `tests/Concerns/FakesJntTariff.php`
- `??` `tests/Feature/CatalogPaginationContractTest.php`
- `??` `tests/Feature/CategoryAutoCodeTest.php`
- `??` `tests/Feature/ModelProductMediaTest.php`
- `??` `tests/Feature/ProductRelatedProductsContractTest.php`
- `??` `tests/Feature/WhatsAppTemplateCatalogTest.php`
- `??` `tests/frontend/breadcrumb-back.test.ts`
- `??` `tests/frontend/media-zoom.test.ts`
- `??` `tests/frontend/pagination.test.ts`
- `??` `tests/frontend/sales-area-chart.test.ts`

### Dokumentasi (12)

- ` M` `docs/AGENT-LOG.md`
- ` M` `docs/MEMORY.md`
- ` M` `docs/PRODUCT-HANDOFF.md`
- ` M` `docs/STANDAR-DESAIN-HALAMAN-PUBLIK.md`
- ` M` `docs/ZALORA-BEM-VISUAL-SYSTEM.md`
- ` M` `docs/decisions/ADR-024-pengaturan-teks-storefront-lapisan-pembanding.md`
- ` M` `frontend/brand/BRAND-KIT.md`
- ` M` `frontend/docs/DESIGN-SYSTEM.md`
- ` M` `frontend/docs/UI-CONSISTENCY-CONTRACT.md`
- `??` `docs/decisions/ADR-022-admin-form-alignment-contract.md`
- `??` `docs/decisions/ADR-025-naskah-template-whatsapp-satu-jalur.md`
- `??` `frontend/docs/ADMIN-DESIGN-LANGUAGE.md`

### Kandidat sementara (6)

- `??` `_archive/cta-storefront/`
- `??` `patch_all_action_menus.py`
- `??` `patch_all_action_menus2.py`
- `??` `patch_library_only_1.py`
- `??` `patch_remove_drafts_ui.py`
- `??` `tests/_archive/`

### Belum diketahui (0)

Tidak ada berkas pada kategori ini.
