import { chromium } from "playwright"
const BASE = "http://localhost:8200"
const OUT = "/tmp/audit-final"

const run = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" })
  await page.fill("#login-identifier", "qa.admin@example.com")
  await page.fill("#login-password", "QaScreenshot2026!")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin/, { timeout: 15000 })

  const shots = [
    ["imports-create", "/admin/imports/create", "light"],
    ["whatsapp-connection", "/admin/whatsapp/connection", "light"],
    ["settings", "/admin/settings", "light"],
    ["dashboard-dark", "/admin", "dark"],
    ["orders-dark", "/admin/orders", "dark"],
    ["analytics-dark", "/admin/analytics/store-performance", "dark"],
    ["customers-dark", "/admin/customers", "dark"],
    ["whatsapp-templates-dark", "/admin/whatsapp/templates", "dark"],
  ]

  for (const [name, path, mode] of shots) {
    if (mode === "dark") {
      await page.evaluate(() => localStorage.setItem("admin-theme", "dark"))
    }
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 25000 })
    await page.waitForTimeout(1100)
    await page.screenshot({ path: `${OUT}/${name}.png` })
    console.log("ok", name)
    if (mode === "dark") {
      await page.evaluate(() => localStorage.removeItem("admin-theme"))
    }
  }

  // Mobile responsive
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mob.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" })
  await mob.fill("#login-identifier", "qa.admin@example.com")
  await mob.fill("#login-password", "QaScreenshot2026!")
  await mob.click('button[type="submit"]')
  await mob.waitForURL(/\/admin/, { timeout: 15000 })
  for (const [name, path] of [["m-dashboard","/admin"],["m-orders","/admin/orders"],["m-products-create","/admin/products/create"],["m-customers","/admin/customers"]]) {
    await mob.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 25000 })
    await mob.waitForTimeout(1000)
    await mob.screenshot({ path: `${OUT}/${name}.png` })
    console.log("ok", name)
  }

  await browser.close()
  console.log("final done")
}
run().catch((e) => { console.error(e); process.exit(1) })
