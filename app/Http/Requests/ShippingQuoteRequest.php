<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ShippingQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'weight_kg' => ['required', 'numeric', 'min:0.01', 'max:100000'],
            'destination_city' => ['required', 'string', 'max:120'],
            'destination_province' => ['nullable', 'string', 'max:120'],
            'destination_area' => ['nullable', 'string', 'max:120'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'village_id' => ['nullable', 'string', 'max:32'],
            'village_name' => ['nullable', 'string', 'max:160'],
            'district_id' => ['nullable', 'string', 'max:32'],
            'district_name' => ['nullable', 'string', 'max:120'],
        ];
    }

    public function withValidator(\Illuminate\Validation\Validator $validator): void
    {
        $validator->after(function (\Illuminate\Validation\Validator $validator): void {
            if ($validator->errors()->has('postal_code') || ! filled($this->input('postal_code'))) {
                return;
            }

            $result = app(\App\Support\PostalCodeRepository::class)->validate(
                $this->input('postal_code'),
                $this->input('village_id'),
                $this->input('village_name'),
                $this->input('district_id'),
                $this->input('district_name'),
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
