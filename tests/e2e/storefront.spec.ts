import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

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

test("storefront shell is useful with an empty catalog", async ({ page }, testInfo) => {
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
  await page.goto("/windows")

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAccessibilityViolations(page)
})

test("cart empty state stays actionable", async ({ page }) => {
  await page.goto("/cart")

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: /model produk/i }).first()).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test("order lookup exposes its privacy fields", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/order/status")

  await expect(page.getByRole("heading", { level: 1, name: "Lacak pesanan Anda." })).toBeVisible()
  await expect(page.getByLabel("Nomor pesanan")).toBeVisible()
  await expect(page.getByLabel("Nomor HP/WhatsApp")).toBeVisible()

  await page.getByRole("button", { name: "Email" }).click()
  await expect(page.getByLabel("Email")).toBeVisible()

  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAccessibilityViolations(page)
})

test("admin login remains keyboard-accessible", async ({ page }) => {
  test.setTimeout(45_000)
  await page.context().clearCookies()
  await page.goto("/login")
  await expect(page).toHaveURL(/\/login/)

  await expect(page).toHaveTitle(/Login Admin/)
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.locator("#login-password")).toBeVisible()
  await expect(page.locator("#login-password")).toHaveAccessibleName(/Password/)
  await expect(page.getByRole("button", { name: "Masuk" })).toBeEnabled()

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
  await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible()

  await page.getByLabel("Email").fill("test@example.com")
  await page.locator("#login-password").fill("password")
  await page.getByRole("button", { name: "Masuk" }).click()

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
