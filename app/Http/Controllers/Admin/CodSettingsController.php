<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\CodSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CodSettingsController extends Controller
{
    public function edit(): Response
    {
        $settings = CodSettings::get();

        return Inertia::render('Admin/CodSettings/Edit', [
            'title' => 'Biaya COD',
            'description' => 'Aktifkan COD, atur biaya penanganan, dan batas maksimal nilai belanja.',
            'settings' => $settings,
            'submitUrl' => route('admin.cod-settings.update'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'fee_type' => ['required', 'in:percent'],
            'fee_value' => [
                'required',
                'numeric',
                'min:0',
                Rule::when($request->input('fee_type') === 'percent', ['max:100']),
            ],
            'max_order_amount' => ['nullable', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        CodSettings::update($validated, (int) $request->user()->id, ['reason' => $validated['reason'] ?? null]);

        return redirect()->route('admin.cod-settings.edit')
            ->with('success', 'Pengaturan Biaya COD disimpan.');
    }
}
