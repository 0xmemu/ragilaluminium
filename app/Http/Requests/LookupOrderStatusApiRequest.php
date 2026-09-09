<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Direct API callers may provide the phone; browser polling uses the verified session.
 */
class LookupOrderStatusApiRequest extends FormRequest
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
            'customer_phone' => ['nullable', 'string'],
        ];
    }
}
