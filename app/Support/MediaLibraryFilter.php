<?php

namespace App\Support;

use App\Models\MediaAsset;
use App\Models\MediaFolder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Filter daftar aset Media Library, dipakai bersama oleh dua tempat:
 *
 *  1. `ProductMediaController::library()`, yaitu daftar yang benar-benar tampil
 *     di halaman, dan
 *  2. aksi massal ber-scope "Pilih semua", yang harus menyentuh SELURUH aset
 *     pada folder + filter aktif, bukan hanya yang kebetulan ada di halaman
 *     pertama.
 *
 * Disatukan di sini supaya keduanya tidak pernah berbeda pendapat. Bila aturan
 * filter hanya diubah di salah satu tempat, "Pilih semua" akan menghitung aset
 * yang berbeda dari yang dilihat admin, dan itu berbahaya untuk aksi hapus.
 *
 * Nama parameter folder: `scope_folder_id` menang bila ada. Alasannya endpoint
 * pindah massal memakai `folder_id` sebagai TUJUAN, sehingga memakai nama yang
 * sama untuk asal akan membuat filter menyasar folder yang salah.
 *
 * Nilai dibaca lewat `input()`, bukan `query()`. Filter ini dipakai dua jenis
 * permintaan: GET (halaman daftar) dan POST (aksi massal). `query()` hanya
 * membaca query string sehingga seluruh filter pada POST terlewat, dan aksi
 * massal akan menyasar kumpulan aset yang salah. Jangan kembalikan ke query().
 */
final class MediaLibraryFilter
{
    /** Query aset sesuai filter halaman Media Library. */
    public static function apply(Request $request): Builder
    {
        $folderKey = $request->filled('scope_folder_id') ? 'scope_folder_id' : 'folder_id';
        $folderId = $request->filled($folderKey) ? (string) $request->input($folderKey) : null;

        return MediaAsset::query()
            ->when($folderId !== null, function (Builder $query) use ($folderId): void {
                if ((int) $folderId === 0) {
                    $query->whereNull('folder_id'); // Inbox
                } else {
                    // Folder induk ikut memuat media di subfolder bawahnya, supaya
                    // folder yang isinya tersimpan di subfolder tidak tampak kosong.
                    // Aksi massal "Pilih semua" memakai penyaring yang sama, jadi
                    // sasarannya pun menyertakan subfolder.
                    $folder = MediaFolder::find((int) $folderId);
                    $query->whereIn('folder_id', $folder ? $folder->descendantIds() : [(int) $folderId]);
                }
            })
            // Aset yang diarsipkan disembunyikan kecuali diminta lewat filter,
            // supaya daftar bawaan hanya memuat aset yang masih aktif.
            ->when(! $request->filled('visibility'), fn (Builder $query) => $query->where('visibility', '!=', 'archived'))
            ->when(! $request->filled('status'), fn (Builder $query) => $query->where('status', '!=', 'archived'))
            ->when($request->filled('q'), function (Builder $query) use ($request): void {
                $q = trim((string) $request->input('q'));
                $query->where(fn (Builder $inner) => LikeSearch::whereLike($inner, 'label', $q)
                    ->orWhereRaw('source_url LIKE ? ESCAPE ?', [LikeSearch::pattern($q), '\\']));
            })
            ->when($request->filled('kind'), fn (Builder $query) => $query->where('kind', $request->input('kind')))
            ->when($request->filled('status'), fn (Builder $query) => $query->where('status', $request->input('status')))
            ->when($request->filled('visibility'), fn (Builder $query) => $query->where('visibility', $request->input('visibility')));
    }
}
