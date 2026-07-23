# Component Inventory

## Shared primitives

- Button, IconButton, LinkButton
- Input, Textarea, Select, Checkbox
- Field, FieldError, FormSummary
- Dialog, Sheet, Dropdown
- Alert, FlashMessage, StatusBadge
- Skeleton, EmptyState, ErrorState
- Pagination
- ResponsiveImage
- Price, QuantityControl
- Breadcrumbs

## Public

- AnnouncementBar
- PublicHeader, MegaMenu, MobileMenu, MobileBottomNav
- SearchDialog
- PublicFooter
- PrecisionFrame
- ProductCard, ProductRail
- ModelCard, ModelFilter
- CatalogFilters, SortControl, ActiveFilters
- ProductGallery, VariantSelector, ProductConfigurator
- TestimonialCard
- CartLineItem, OrderSummary
- CheckoutDetailsForm, PaymentMethod
- OrderStatusTimeline
- CmsContent

## Admin

- AdminSidebar, AdminTopbar, AdminMobileNav
- PageHeader, StatBlock, PriorityNotice
- ResourceTable, ResourceCards, ResourceFilters
- ResourceDetail, DetailSection
- ConfirmAction
- FileDropzone
- ProductForm, VariantForm
- StatusSelect

## State contract

Komponen data wajib mendukung:

- loading
- empty
- error
- success/flash
- disabled
- pending submission
- reduced motion

## Composition rules

- Gunakan ProductCard hanya untuk product entity dan ModelCard hanya untuk taxonomy entry.
- Generic ResourceTable tidak menangani business mutation sendiri.
- StatusBadge hanya menerima status yang sudah dipetakan helper.
- Layout tidak mengandung hardcoded route atau nomor WhatsApp.
- Icon dipilih melalui satu registry Phosphor.
