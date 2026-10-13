<?php

namespace Tests\Feature;

use App\Http\Middleware\EnsureUserIsAdmin;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class AdminAuthorizationBoundaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_admin_controller_route_is_inside_the_admin_security_boundary(): void
    {
        $checked = 0;

        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->getActionName(), 'App\\Http\\Controllers\\Admin\\')) {
                continue;
            }

            $checked++;
            $middleware = $route->gatherMiddleware();
            $uri = $route->uri();

            $this->assertContains('auth', $middleware, "Admin route {$uri} is missing auth middleware.");
            $this->assertContains('admin', $middleware, "Admin route {$uri} is missing admin middleware.");
            $this->assertTrue(
                $uri === 'admin' || str_starts_with($uri, 'admin/'),
                "Admin controller route {$uri} is outside the /admin boundary.",
            );
        }

        $this->assertGreaterThan(50, $checked, 'Admin route inventory unexpectedly became empty or incomplete.');
    }

    public function test_guest_and_inactive_admin_cannot_enter_the_dashboard(): void
    {
        $this->get(route('admin.dashboard'))->assertRedirect(route('login'));

        $inactiveAdmin = User::factory()->create(['role' => 'admin', 'status' => 'inactive']);
        $this->actingAs($inactiveAdmin)
            ->get(route('admin.dashboard'))
            ->assertRedirect(route('login'));
    }

    public function test_active_non_admin_is_forbidden_by_the_admin_middleware(): void
    {
        $request = Request::create('/admin');
        $user = new User;
        $user->forceFill(['role' => 'customer', 'status' => 'active']);
        $request->setUserResolver(fn () => $user);

        try {
            app(EnsureUserIsAdmin::class)->handle($request, fn () => response('ok'));
            $this->fail('An active non-admin must not pass the admin middleware.');
        } catch (HttpException $exception) {
            $this->assertSame(403, $exception->getStatusCode());
        }
    }
}
