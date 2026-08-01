import { chromium } from "playwright"
const BASE = "http://localhost:8200"
const OUT = "/tmp/admin-final"
const run = async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
  await page.fill("#login-identifier", "qa.admin@example.com")
  await page.fill("#login-password", "QaScreenshot2026!")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin/, { timeout: 15000 })

  // dark mode via localStorage appearance
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" })
  await page.evaluate(() => localStorage.setItem("appearance", "dark"))
  for (const [name, path] of [["dashboard-dark", "/admin"], ["products-dark", "/admin/products"], ["orders-dark", "/admin/orders"]]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/${name}.png` })
  }
  await page.evaluate(() => localStorage.setItem("appearance", "light"))

  // mobile
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/dashboard-mobile.png` })
  await page.goto(`${BASE}/admin/products`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/products-mobile.png` })

  // storefront sanity
  await ctx.clearCookies()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/storefront-home.png` })
  await page.goto(`${BASE}/reviews`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/storefront-reviews.png` })

  await browser.close()
  console.log("final done")
}
run().catch((e) => { console.error(e); process.exit(1) })
