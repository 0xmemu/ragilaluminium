import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

// Nilai yang dikirim lewat form checkout dan harus tersimpan ke record order.
const E2E_ADDRESS_LINE2 = "Dekat gerbang utama"
const E2E_ORDER_NOTES = "Hubungi sebelum pengiriman"

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }))

  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1)
}

async function expectNoSeriousAccessibilityViolations(page: import("@playwright/test").Page) {
  // Wait out Inertia/NProgress chrome (invalid role="bar") before auditing.
  await page.locator(".bar[role='bar']").waitFor({ state: "detached", timeout: 5_000 }).catch(() => {})

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .exclude(".bar")
    .analyze()

  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  )

  expect(
    blocking,
    blocking
      .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`)
      .join("\n"),
  ).toEqual([])
}

async function expectFirstTabFocusLeavesBody(page: import("@playwright/test").Page) {
  await page.keyboard.press("Tab")
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName)
  expect(focusedTag).not.toBe("BODY")
}

/**
 * Verifikasi bahwa data yang dikirim lewat form checkout benar-benar tersimpan ke
 * database aplikasi (SQLite E2E terisolasi yang dipakai webServer Playwright).
 */
async function expectOrderPersisted(orderNumber: string) {
  const db = new DatabaseSync(join(process.cwd(), "database/e2e.sqlite"), { readOnly: true })
  try {
    const row = db
      .prepare("SELECT shipping_address_line2, notes FROM orders WHERE order_number = ?")
      .get(orderNumber) as
      | { shipping_address_line2: string | null; notes: string | null }
      | undefined

    expect(row, `order ${orderNumber} should exist in e2e.sqlite`).toBeDefined()
    expect(row?.shipping_address_line2, "address_line2 harus tersimpan di order").toBe(
      E2E_ADDRESS_LINE2,
    )
    expect(row?.notes, "notes harus tersimpan di order").toBe(E2E_ORDER_NOTES)
  } finally {
    db.close()
  }
}

async function openCheckoutFromProduct(page: import("@playwright/test").Page) {
  await page.route("**/api/wilayah/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith("/provinces")
      ? [{ id: "prov-1", name: "Jawa Tengah" }]
      : path.endsWith("/regencies/prov-1")
        ? [{ id: "city-1", name: "Kabupaten Banjarnegara" }]
        : path.endsWith("/districts/city-1")
          ? [{ id: "district-1", name: "Mandiraja" }]
          : [{ id: "village-1", name: "Mandiraja Wetan" }]

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data }),
    })
  })
  await page.goto("/product/DEVPREVIEW-001")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  const variantGroups = page.getByRole("group")
  await variantGroups.nth(0).getByRole("button", { name: "Silver", exact: true }).click()
  await variantGroups.nth(1).getByRole("button", { name: "Bening", exact: true }).click()
  await expect(page.getByText(/Stok \d+/)).toBeVisible()

  await page
    .locator("button:visible")
    .filter({ hasText: "Beli Sekarang" })
    .first()
    .click()
  await expect(page).toHaveURL(/\/checkout$/)
}

async function chooseFirstWilayahOption(
  page: import("@playwright/test").Page,
  id: string,
) {
  await page.locator(`#${id}`).click()
  await expect(page.getByRole("listbox")).toBeVisible()
  await expect(page.getByRole("option").first()).toBeVisible()
  await page.getByRole("option").first().click()
}

async function fillCheckoutDetails(page: import("@playwright/test").Page) {
  await page.getByLabel("Nama lengkap").fill("Pelanggan E2E")
  await page.getByLabel("Nomor HP/WhatsApp").fill("081234567890")
  await page.getByLabel("Email").fill("e2e@example.com")
  await chooseFirstWilayahOption(page, "checkout-province")
  await chooseFirstWilayahOption(page, "checkout-city")
  await chooseFirstWilayahOption(page, "checkout-district")
  await chooseFirstWilayahOption(page, "checkout-village")
  await page.getByLabel("Alamat lengkap").fill("Jalan E2E Nomor 10")
  await page.getByLabel("Patokan atau detail tambahan").fill(E2E_ADDRESS_LINE2)
  await page.getByLabel("Kode pos").fill("40123")
  await page.getByLabel("Catatan pesanan").fill(E2E_ORDER_NOTES)
}

test("storefront shell is useful with a seeded catalog", async ({ page }, testInfo) => {
  await page.goto("/")

  await expect(page).toHaveTitle(/Ragil Aluminium/)
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Bukaan presisi untuk rumah yang terasa lebih lega.",
    }),
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Pilih model produk" })).toBeVisible()

  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAccessibilityViolations(page)
  await page.screenshot({
    path: testInfo.outputPath("home-full-page.png"),
    fullPage: true,
  })
})

test("catalog discovery keeps filters and empty states usable", async ({ page }) => {
  await page.goto("/products/windows")

  await expect(page.getByRole("heading", { level: 1, name: "Jendela" })).toBeVisible()
  await expect(page.getByText(/\d+ Barang ditemukan/)).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAccessibilityViolations(page)
})

test("cart empty state stays actionable", async ({ page }) => {
  await page.goto("/cart")

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: /model produk/i }).first()).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAccessibilityViolations(page)
})

test("product detail page is accessible and keyboard-navigable", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/product/DEVPREVIEW-001")

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAccessibilityViolations(page)
  await expectFirstTabFocusLeavesBody(page)
})

test("order lookup exposes its privacy fields", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/order/status")

  await expect(page.getByRole("heading", { level: 1, name: "Cek pesanan" })).toBeVisible()
  await expect(page.getByLabel("Nomor pesanan")).toBeVisible()
  await expect(page.getByLabel("Nomor HP/WhatsApp")).toBeVisible()

  await page.getByRole("button", { name: "Email" }).click()
  await expect(page.getByLabel("Email")).toBeVisible()

  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAccessibilityViolations(page)
})

test("customer can complete guest checkout and look up the order", async ({ page }) => {
  test.setTimeout(120_000)
  await openCheckoutFromProduct(page)

  await expect(page.getByRole("heading", { level: 2, name: "Detail pengiriman" })).toBeVisible()
  await fillCheckoutDetails(page)
  await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click()

  await expect(page.getByRole("heading", { level: 2, name: "Metode pembayaran" })).toBeVisible()
  await expect(page.getByText(/Pengiriman|Ongkir dibayar/).last()).toBeVisible()
  await page.locator('input[name="payment_method"][value="transfer"]').check()

  let placeOrderRequests = 0
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/checkout/place-order")) {
      placeOrderRequests += 1
    }
  })

  const placeOrderButton = page
    .locator("button:visible")
    .filter({ hasText: "Buat pesanan" })
    .first()
  await placeOrderButton.click()
  await expect(page).toHaveURL(/\/order\/[^/]+\/confirmation$/, { timeout: 60_000 })
  expect(placeOrderRequests).toBe(1)

  await expect(page.getByRole("heading", { level: 1, name: "Pesanan berhasil" })).toBeVisible()
  const orderNumber = (await page.getByText(/^RA-\d{6}-[A-Z0-9]{6}$/).textContent())?.trim()
  expect(orderNumber).toMatch(/^RA-\d{6}-[A-Z0-9]{6}$/)

  // address_line2 ("Patokan atau detail tambahan") dan notes ("Catatan pesanan")
  // yang dikirim lewat form harus benar-benar tersimpan di record order.
  await expectOrderPersisted(orderNumber!)

  await page.goto("/order/status")
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan di perangkat ini" })).toBeVisible()
  await expect(page.getByText("Pesanan perangkat ini")).toBeVisible()
  await expect(page.getByText(orderNumber ?? "").first()).toBeVisible()
})

test("checkout shows pending state and blocks duplicate place-order submissions", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openCheckoutFromProduct(page)

  await expect(page.getByRole("heading", { level: 2, name: "Detail pengiriman" })).toBeVisible()
  await fillCheckoutDetails(page)
  await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click()

  await expect(page.getByRole("heading", { level: 2, name: "Metode pembayaran" })).toBeVisible()
  await page.locator('input[name="payment_method"][value="transfer"]').check()

  // Audit aksesibilitas halaman checkout pada langkah pembayaran.
  await expectNoSeriousAccessibilityViolations(page)

  let placeOrderRequests = 0
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/checkout/place-order")) {
      placeOrderRequests += 1
    }
  })

  // Tahan response agar state pending bisa diamati (bukan sekadar cepat berlalu).
  // 4 detik memberi ruang untuk dua assertion auto-wait di VPS yang sibuk.
  await page.route("**/checkout/place-order", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4_000))
    await route.continue()
  })

  const pendingButton = page.locator("button:visible").filter({ hasText: "Membuat pesanan" })
  await page.locator("button:visible").filter({ hasText: "Buat pesanan" }).first().click()

  // State pending: tombol menampilkan "Membuat pesanan..." dan dinonaktifkan.
  await expect(pendingButton.first()).toHaveText(/Membuat pesanan/)
  await expect(pendingButton.first()).toBeDisabled()

  // Klik kedua saat masih pending tidak boleh memicu request tambahan.
  await pendingButton.first().click({ force: true, timeout: 3_000 })

  await expect(page).toHaveURL(/\/order\/[^/]+\/confirmation$/, { timeout: 60_000 })
  expect(placeOrderRequests).toBe(1)
})

test("checkout keeps the customer on the form when required details are missing", async ({ page }) => {
  test.setTimeout(90_000)
  await openCheckoutFromProduct(page)

  await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByLabel("Nama lengkap")).toHaveValue("")
  await expect(page.getByRole("button", { name: "Lanjut ke pembayaran" })).toBeVisible()
  await expect(page.getByRole("heading", { level: 2, name: "Metode pembayaran" })).toBeVisible()
  await expect(page.locator('input[name="payment_method"]').first()).toBeDisabled()
})

test("admin login remains keyboard-accessible", async ({ page }) => {
  test.setTimeout(45_000)
  await page.context().clearCookies()
  await page.goto("/login")
  await expect(page).toHaveURL(/\/login/)

  await expect(page).toHaveTitle(/login admin/i)
  await expect(page.getByLabel("email/username")).toBeVisible()
  await expect(page.locator("#login-password")).toBeVisible()
  await expect(page.locator("#login-password")).toHaveAccessibleName(/password/i)
  await expect(page.getByRole("button", { name: "masuk" })).toBeEnabled()

  await page.keyboard.press("Tab")
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName)
  expect(focusedTag).not.toBe("BODY")

  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAccessibilityViolations(page)
})

test("admin dashboard adapts after authenticated login", async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.context().clearCookies()

  await page.goto("/login")
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("button", { name: "masuk" })).toBeVisible()

  await page.getByLabel("email/username").fill("test@example.com")
  await page.locator("#login-password").fill("password")
  await page.getByRole("button", { name: "masuk" }).click()

  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 60_000 })
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible({
    timeout: 30_000,
  })

  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAccessibilityViolations(page)
  await page.screenshot({
    path: testInfo.outputPath("admin-dashboard-full-page.png"),
    fullPage: true,
  })
})

test("homepage meets local rendering performance budgets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop performance budget")
  test.setTimeout(60_000)

  await page.addInitScript(() => {
    const metrics = { cls: 0, lcp: 0 }
    Object.defineProperty(window, "__ragilVitals", { value: metrics, writable: false })

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) metrics.lcp = entry.startTime
    }).observe({ type: "largest-contentful-paint", buffered: true })

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }
        if (!shift.hadRecentInput) metrics.cls += shift.value
      }
    }).observe({ type: "layout-shift", buffered: true })
  })

  await page.goto("/")
  await page.waitForLoadState("domcontentloaded")
  // Warm path + second navigation avoids cold WSL/asset first-hit noise.
  await page.goto("/")
  await page.waitForLoadState("domcontentloaded")
  await page.waitForTimeout(500)

  const metrics = await page.evaluate(() => {
    const vitals = (
      window as unknown as Window & { __ragilVitals: { cls: number; lcp: number } }
    ).__ragilVitals
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming

    return {
      cls: vitals.cls,
      lcp: vitals.lcp,
      domContentLoaded: navigation.domContentLoadedEventEnd,
    }
  })

  expect(metrics.lcp).toBeGreaterThan(0)
  expect(metrics.lcp).toBeLessThan(8000)
  expect(metrics.cls).toBeLessThan(0.15)
  expect(metrics.domContentLoaded).toBeLessThan(8000)
})
