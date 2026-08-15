<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\ShippingSubsidySettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ShippingSubsidyController extends Controller
{
    public function edit(): Response
    {
        $settings = ShippingSubsidySettings::get();

        return Inertia::render('Admin/ShippingSubsidy/Edit', [
            'title' => 'Subsidi Ongkir',
            'description' => 'Potongan biaya pengiriman untuk pelanggan, dan kurir yang ikut skema subsidi.',
            'settings' => [
                'enabled' => $settings['enabled'],
                'subsidy_type' => $settings['subsidy_type'],
                'subsidy_value' => $settings['subsidy_value'],
                'jnt_enabled' => $settings['carriers']['jnt'],
            'reason' => ['nullable', 'string', 'max:1000'],
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'subsidy_type' => ['required', 'in:percent,fixed'],
            'subsidy_value' => [
                'required',
                'numeric',
                'min:0',
                Rule::when($request->input('subsidy_type') === 'percent', ['max:100']),
            ],
            'jnt_enabled' => ['required', 'boolean'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        ShippingSubsidySettings::update($validated, (int) $request->user()->id, ['reason' => $validated['reason'] ?? null]);

        return redirect()->route('admin.shipping-subsidy.edit')
            ->with('success', 'Pengaturan Subsidi Ongkir disimpan.');
    }
}
