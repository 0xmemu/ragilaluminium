import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { WilayahSearchSelect } from "@/components/public/wilayah-search-select"
import type { CheckoutController } from "@/hooks/use-checkout"
import type { CheckoutDetails } from "@/types"

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
    selectProvince,
    selectCity,
    selectDistrict,
    selectVillage,
    submitDetails,
    addressSummary,
  } = c

  return (
    <section className="surface-panel min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4 min-w-0 pb-3 border-b border-border">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-foreground">Detail Pengiriman</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
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
        <dl className="mt-4 grid gap-3 rounded-lg bg-surface-muted/60 border border-border p-3.5 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Pemesan</dt>
            <dd className="mt-1 font-semibold text-foreground break-words [overflow-wrap:anywhere]">{details.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nomor HP/WhatsApp</dt>
            <dd className="mt-1 font-semibold text-foreground break-words [overflow-wrap:anywhere]">{details.phone}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Alamat</dt>
            <dd className="mt-1 font-semibold leading-relaxed text-foreground break-words [overflow-wrap:anywhere]">{addressSummary}</dd>
          </div>
        </dl>
      ) : (
        <form onSubmit={submitDetails} className="mt-4 space-y-3.5">
          <FormErrorSummary errors={detailForm.errors} />
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field id="checkout-name" label="Nama lengkap" required error={detailForm.errors.name}>
              <Input
                value={detailForm.data.name}
                onChange={(event) => detailForm.setData("name", event.target.value)}
                autoComplete="name"
                placeholder="Masukkan nama lengkap"
                className="rounded-md"
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
                placeholder="08xxxxxxxxxx"
                className="rounded-md"
              />
            </Field>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
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
              placeholder="Pilih Provinsi"
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
              hint="Terisi otomatis dari data desa/kelurahan."
              error={detailForm.errors.postal_code}
              className="sm:col-span-2"
            >
              <Input
                value={detailForm.data.postal_code}
                readOnly={Boolean(detailForm.data.postal_code)}
                aria-readonly={detailForm.data.postal_code ? "true" : undefined}
                onChange={(event) => detailForm.setData("postal_code", event.target.value)}
                placeholder="Isi Otomatis"
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
            hint="Nama jalan, nomor rumah, RT/RW, Patokan."
            error={detailForm.errors.address_line1}
          >
            <Textarea
              rows={3}
              value={detailForm.data.address_line1}
              onChange={(event) => detailForm.setData("address_line1", event.target.value)}
              autoComplete="street-address"
              placeholder="Nama jalan, nomor rumah, RT/RW, Patokan."
              className="rounded-md text-xs"
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
              placeholder="Contoh: Dekat masjid / pagar hitam"
              className="rounded-md"
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            {details ? (
              <Button variant="ghost" size="sm" onClick={() => setEditingDetails(false)}>
                Batal
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={detailForm.processing}>
              {detailForm.processing ? "Memvalidasi..." : "Simpan Alamat"}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
