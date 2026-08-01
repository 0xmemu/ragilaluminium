// TEMPORARY QA screenshot script — dihapus setelah verifikasi visual admin redesign.
import { chromium } from "playwright"

const BASE = process.env.QA_BASE_URL ?? "http://localhost:8200"
const OUT = "/tmp/admin-shots"

const pages = (process.env.QA_PAGES ?? "dashboard:/admin,orders:/admin/orders,products:/admin/products")
  .split(",")
  .map((pair) => {
    const [name, path] = pair.split(":")
    return { name, path }
  })

const run = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
  await page.fill("#login-identifier", "qa.admin@example.com")
  await page.fill("#login-password", "QaScreenshot2026!")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin/, { timeout: 15000 })
  await page.waitForLoadState("networkidle")

  for (const target of pages) {
    await page.goto(`${BASE}${target.path}`, { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/${target.name}-light.png`, fullPage: false })
  }

  await browser.close()
  console.log("screenshots done")
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
