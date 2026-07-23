import { defineConfig, devices } from "@playwright/test"
import { execFileSync } from "node:child_process"

const serverHost =
  process.env.E2E_HOST ??
  (process.platform === "win32"
    ? execFileSync("wsl", ["hostname", "-I"], { encoding: "utf8" }).trim().split(/\s+/)[0]
    : "127.0.0.1")
const baseURL = `http://${serverHost}:8010`
const laravelCommand = `export APP_ENV=testing APP_URL=${baseURL} APP_KEY=base64:MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI= APP_DEBUG=false DB_CONNECTION=sqlite DB_DATABASE=database/e2e.sqlite CACHE_STORE=array SESSION_DRIVER=cookie QUEUE_CONNECTION=sync MAIL_MAILER=array; touch database/e2e.sqlite; php artisan migrate:fresh --seed --force; php artisan serve --host=0.0.0.0 --port=8010`
const webServerCommand =
  process.platform === "win32"
    ? `wsl bash -lc "${laravelCommand}"`
    : `bash -lc "${laravelCommand}"`

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile-360-chromium",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: "tablet-768-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "compact-1024-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
      },
    },
  ],
})
