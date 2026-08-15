<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Support\PostalCodeRepository;
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
        });
    }
}
