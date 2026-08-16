<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable("categories")) {
            DB::table("categories")->where("code", "WINDOW")->orWhere("slug", "windows")->update(["code" => "JENDELA", "slug" => "jendela", "name" => "Jendela"]);
            DB::table("categories")->where("code", "DOOR")->orWhere("slug", "doors")->update(["code" => "PINTU", "slug" => "pintu", "name" => "Pintu"]);
            DB::table("categories")->where("code", "BOUVEN")->orWhere("slug", "bouven")->update(["code" => "BOVEN", "slug" => "boven", "name" => "Boven"]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable("categories")) {
            DB::table("categories")->where("code", "JENDELA")->where("slug", "jendela")->update(["code" => "WINDOW", "slug" => "windows"]);
            DB::table("categories")->where("code", "PINTU")->where("slug", "pintu")->update(["code" => "DOOR", "slug" => "doors"]);
            DB::table("categories")->where("code", "BOVEN")->where("slug", "boven")->update(["code" => "BOUVEN", "slug" => "bouven"]);
        }
    }
};
