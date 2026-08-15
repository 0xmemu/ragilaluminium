import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { WilayahSearchSelect } from "@/components/public/wilayah-search-select"
import type { CheckoutController } from "@/hooks/use-checkout"
import type { CheckoutDetails } from "@/types"

/**
 * Section 01 — Detail pengiriman: ringkasan alamat saat sudah tervalidasi,
 * atau form lengkap (data diri, wilayah, alamat, kode pos, catatan) saat
 * pertama kali / sedang diedit. Semua state datang dari `useCheckout` (§5 R).
 */
export function CheckoutAddressForm({
  details,
  c,
}: {
  details: CheckoutDetails | null
  c: CheckoutController
}) {
  const {
    editingDetails,
    setEditingDetails,
    detailForm,
    provinces,
    regencies,
    districts,
    villages,
    loadingProvinces,
    loadingRegencies,
    loadingDistricts,
    loadingVillages,
    wilayahError,
    setWilayahRetry,
    setMapPickerOpen,
    selectProvince,
    selectCity,
    selectDistrict,
    selectVillage,
    submitDetails,
    addressSummary,
  } = c

  return (
    <section className="surface-panel min-w-0 p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4 min-w-0">
        <div>
          <p className="font-mono text-xs font-semibold text-primary">02</p>
          <h2 className="mt-2 text-lg font-semibold">Detail pengiriman</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Data ini dipakai untuk pesanan, pengiriman, dan pengecekan status.
          </p>
        </div>
        {details && !editingDetails ? (
          <Button variant="ghost" size="sm" onClick={() => setEditingDetails(true)}>
            Ubah
          </Button>
        ) : null}
      </div>

      {details && !editingDetails ? (
        <dl className="mt-4 grid gap-4 rounded-md bg-surface-muted p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Pemesan</dt>
            <dd className="mt-1 font-semibold break-words [overflow-wrap:anywhere]">{details.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Nomor HP/WhatsApp</dt>
            <dd className="mt-1 font-semibold break-words [overflow-wrap:anywhere]">{details.phone}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Alamat</dt>
            <dd className="mt-1 font-semibold leading-6 break-words [overflow-wrap:anywhere]">{addressSummary}</dd>
          </div>
        </dl>
      ) : (
        <form onSubmit={submitDetails} className="mt-6 space-y-4">
          <FormErrorSummary errors={detailForm.errors} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="checkout-name" label="Nama lengkap" required error={detailForm.errors.name}>
              <Input
                value={detailForm.data.name}
                onChange={(event) => detailForm.setData("name", event.target.value)}
                autoComplete="name"
              />
            </Field>
            <Field
              id="checkout-phone"
              label="Nomor HP/WhatsApp"
              required
              error={detailForm.errors.phone}
            >
              <Input
                type="tel"
                value={detailForm.data.phone}
                onChange={(event) => detailForm.setData("phone", event.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {wilayahError ? (
              <div className="sm:col-span-2">
                <Alert tone="danger" title="Wilayah tidak tersedia">
                  <p>{wilayahError}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    className="mt-3"
                    onClick={() => setWilayahRetry((value) => value + 1)}
                  >
                    Muat ulang daftar wilayah
                  </Button>
                </Alert>
              </div>
            ) : null}
            <WilayahSearchSelect
              id="checkout-province"
              label="Provinsi"
              options={provinces}
              valueId={detailForm.data.province_id}
              valueName={detailForm.data.province}
              loading={loadingProvinces}
              error={detailForm.errors.province ?? detailForm.errors.province_id}
              placeholder="Pilih provinsi"
              searchPlaceholder="Cari provinsi"
              onSelect={selectProvince}
            />
            <WilayahSearchSelect
              id="checkout-city"
              label="Kota/Kabupaten"
              options={regencies}
              valueId={detailForm.data.city_id}
              valueName={detailForm.data.city}
              disabled={!detailForm.data.province_id}
              loading={loadingRegencies}
              error={detailForm.errors.city ?? detailForm.errors.city_id}
              placeholder="Pilih Kota/Kabupaten..."
              searchPlaceholder="Cari Kota/Kabupaten..."
              onSelect={selectCity}
            />
            <WilayahSearchSelect
              id="checkout-district"
              label="Kecamatan"
              options={districts}
              valueId={detailForm.data.district_id}
              valueName={detailForm.data.district}
              disabled={!detailForm.data.city_id}
              loading={loadingDistricts}
              error={detailForm.errors.district ?? detailForm.errors.district_id}
              placeholder="Pilih Kecamatan..."
              searchPlaceholder="Cari Kecamatan..."
              onSelect={selectDistrict}
            />
            <WilayahSearchSelect
              id="checkout-village"
              label="Desa/Kelurahan"
              options={villages}
              valueId={detailForm.data.village_id}
              valueName={detailForm.data.village}
              disabled={!detailForm.data.district_id}
              loading={loadingVillages}
              error={detailForm.errors.village ?? detailForm.errors.village_id}
              placeholder="Pilih Desa/Kelurahan..."
              searchPlaceholder="Cari Desa/Kelurahan..."
              onSelect={selectVillage}
            />
            <Field
              id="checkout-postal-code"
              label="Kode pos"
              required
              hint="Terisi otomatis dari data desa/kelurahan. Jika mapping belum tersedia, isi manual dari sumber resmi; peta bukan sumber kode pos."
              error={detailForm.errors.postal_code}
              className="sm:col-span-2"
            >
              <Input
                value={detailForm.data.postal_code}
                readOnly={Boolean(detailForm.data.postal_code)}
                aria-readonly={detailForm.data.postal_code ? "true" : undefined}
                onChange={(event) => detailForm.setData("postal_code", event.target.value)}
                placeholder="Otomatis dari desa/kelurahan"
                autoComplete="postal-code"
                inputMode="numeric"
                className="rounded-md"
              />
            </Field>
          </div>

          <Field
            id="checkout-address-1"
            label="Alamat lengkap"
            required
            hint="Nama jalan, nomor rumah, RT/RW."
            error={detailForm.errors.address_line1}
          >
            <Textarea
              rows={3}
              value={detailForm.data.address_line1}
              onChange={(event) => detailForm.setData("address_line1", event.target.value)}
              autoComplete="street-address"
            />
          </Field>
          <Field
            id="checkout-address-2"
            label="Patokan atau detail tambahan"
            error={detailForm.errors.address_line2}
          >
            <Input
              value={detailForm.data.address_line2 ?? ""}
              onChange={(event) => detailForm.setData("address_line2", event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border bg-surface-muted p-3">
            <p className="text-xs leading-5 text-muted-foreground">
              Alamat tidak terdaftar? Pilih titik di Maps sebagai bantuan lokasi. Kode pos tetap
              mengikuti desa/kelurahan yang dipilih.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => setMapPickerOpen(true)}
            >
              <Icon name="map-pin" className="size-4" aria-hidden="true" />
              Pilih titik di Maps (opsional)
            </Button>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
            {details ? (
              <Button variant="ghost" onClick={() => setEditingDetails(false)}>
                Batal
              </Button>
            ) : null}
            <Button type="submit" disabled={detailForm.processing}>
              {detailForm.processing ? "Memvalidasi..." : "Lanjut Ke Pembayaran"}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
