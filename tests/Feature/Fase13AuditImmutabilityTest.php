<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Fase13AuditImmutabilityTest extends TestCase
{
    use RefreshDatabase;

    private function makeLog(User $user): EventLog
    {
        return EventLog::create([
            'event_type' => 'auth.login',
            'entity_type' => 'user',
            'entity_id' => $user->id,
            'payload' => ['ip' => '127.0.0.1'],
            'created_by_user_id' => $user->id,
            'created_at' => now(),
        ]);
    }

    private function user(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_audit_log_is_immutable_against_update(): void
    {
        $log = $this->makeLog($this->user());

        $this->expectException(\LogicException::class);
        $log->update(['event_type' => 'tampered']);
    }

    public function test_audit_log_is_immutable_against_delete(): void
    {
        $log = $this->makeLog($this->user());

        $this->expectException(\LogicException::class);
        $log->delete();
    }

    public function test_audit_log_is_traceable_to_actor(): void
    {
        $admin = $this->user();
        $log = $this->makeLog($admin);

        $this->assertSame('auth.login', $log->event_type);
        $this->assertNotNull($log->createdBy);
        $this->assertSame($admin->id, $log->createdBy->id);
    }
}
