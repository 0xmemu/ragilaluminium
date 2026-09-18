<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\ShippingSubsidySettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
            'submitUrl' => route('admin.shipping-subsidy.update'),
            'settings' => [
                'enabled' => $settings['enabled'],
                'subsidy_value' => $settings['subsidy_value'],
                'jnt_enabled' => $settings['carriers']['jnt'],
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        // Skema subsidi ongkir hanya persentase (keputusan owner 2026-09-18),
        // jadi tidak ada lagi pilihan tipe yang divalidasi.
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'subsidy_value' => ['required', 'numeric', 'min:0', 'max:100'],
            'jnt_enabled' => ['required', 'boolean'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        ShippingSubsidySettings::update($validated, (int) $request->user()->id, ['reason' => $validated['reason'] ?? null]);

        return redirect()->route('admin.shipping-subsidy.edit')
            ->with('success', 'Pengaturan Subsidi Ongkir disimpan.');
    }
}
