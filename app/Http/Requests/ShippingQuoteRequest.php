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

}
