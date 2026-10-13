<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Services\WhatsAppService;
use App\Support\PostalCodeRepository;
use App\Support\PhoneNumber;
use Illuminate\Validation\Validator;

/**
 * Rules moved 1:1 from CheckoutController@validateDetails — no behavior change.
 */
class StoreCheckoutDetailsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
            'province' => ['required', 'string', 'max:100'],
            'city' => ['required', 'string', 'max:100'],
            'district' => ['required', 'string', 'max:100'],
            'village' => ['required', 'string', 'max:100'],
            // ID wilayah hanya penanda pilihan dari dropdown; nama adalah sumber
            // kebenaran. Nullable supaya pilihan lokasi via peta (yang mengisi nama
            // tanpa ID bila nama tidak persis sama dengan daftar Kemendagri) tetap valid.
            'province_id' => ['nullable', 'string', 'max:20'],
            'city_id' => ['nullable', 'string', 'max:20'],
            'district_id' => ['nullable', 'string', 'max:20'],
            'village_id' => ['nullable', 'string', 'max:20'],
            'address_line1' => ['required', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['required', 'string', 'max:20'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->has('postal_code')) {
                return;
            }

            $result = app(PostalCodeRepository::class)->validate(
                $this->input('postal_code'),
                $this->input('village_id'),
                $this->input('village'),
                $this->input('district_id'),
                $this->input('district'),
            );

            if ($result['status'] === 'invalid') {
                $validator->errors()->add(
                    'postal_code',
                    'Kode pos tidak cocok dengan desa/kelurahan yang dipilih.',
                );
            }

            // Penjaga pra-checkout (owner 2026-09-27): nomor yang tidak
            // terdaftar WhatsApp tidak akan pernah menerima notifikasi
            // pesanan (konfirmasi, resi, tindak lanjut). Pemeriksaan tidak
            // tersedia atau gagal = diteruskan (fail-open); cek saat
            // pengiriman tetap berjalan sebagai lapis kedua.
            if (! $validator->errors()->has('phone')) {
                $nomor = PhoneNumber::normalize((string) $this->input('phone'));
                if ($nomor !== null && app(WhatsAppService::class)->numberRegistered($nomor) === false) {
                    $validator->errors()->add(
                        'phone',
                        'Nomor WhatsApp tidak terdaftar. Periksa kembali nomor HP yang dimasukkan.',
                    );
                }
            }
        });
    }
}
