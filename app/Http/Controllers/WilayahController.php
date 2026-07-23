<?php

namespace App\Http\Controllers;

use App\Support\WilayahRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WilayahController extends Controller
{
    public function __construct(protected WilayahRepository $wilayah)
    {
    }

    public function provinces(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->wilayah->provinces($request->query('q')),
        ]);
    }

    public function regencies(Request $request, string $provinceId): JsonResponse
    {
        return response()->json([
            'data' => $this->wilayah->regencies($provinceId, $request->query('q')),
        ]);
    }

    public function districts(Request $request, string $regencyId): JsonResponse
    {
        return response()->json([
            'data' => $this->wilayah->districts($regencyId, $request->query('q')),
        ]);
    }

    public function villages(Request $request, string $districtId): JsonResponse
    {
        return response()->json([
            'data' => $this->wilayah->villages($districtId, $request->query('q')),
        ]);
    }
}
