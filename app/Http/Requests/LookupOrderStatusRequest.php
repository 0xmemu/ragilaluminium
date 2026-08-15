<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Rules moved 1:1 from OrderController@statusLookup — no behavior change.
 */
class LookupOrderStatusRequest extends FormRequest
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
            'customer_phone' => ['required', 'string'],
            'order_number' => ['required', 'string'],
        ];
    }
}
