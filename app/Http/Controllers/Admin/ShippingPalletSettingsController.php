<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\ShippingPalletSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ShippingPalletSettingsController extends Controller
{
    public function edit(): Response
    {
        $settings = ShippingPalletSettings::get();

        return Inertia::render('Admin/ShippingPallet/Edit', [
            'title' => 'Pallet Pengiriman',
            'description' => 'Allowance default kemasan kayu/pallet di semua sisi (cm). Nilai per produk menimpa pengaturan ini.',
            'submitUrl' => route('admin.shipping-pallet.update'),
            'settings' => [
                'allowance_per_side_cm' => (float) ($settings['allowance_per_side_cm'] ?? 3.0),
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'allowance_per_side_cm' => ['required', 'numeric', 'min:0', 'max:100'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        ShippingPalletSettings::update(
            ['allowance_per_side_cm' => (float) $validated['allowance_per_side_cm']],
            (int) $request->user()->id,
            ['reason' => $validated['reason'] ?? null],
        );

        return redirect()->route('admin.shipping-pallet.edit')
            ->with('success', 'Pengaturan pallet allowance disimpan.');
    }
}
