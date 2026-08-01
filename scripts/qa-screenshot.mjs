// TEMPORARY QA screenshot script — dihapus setelah verifikasi visual admin redesign.
import { chromium } from "playwright"

const BASE = process.env.QA_BASE_URL ?? "http://localhost:8200"
const OUT = "/tmp/admin-shots"

const pages = [
  { name: "dashboard", path: "/admin" },
  { name: "orders", path: "/admin/orders" },
  { name: "products", path: "/admin/products" },
]

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
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/${target.name}-light.png`, fullPage: false })

    // Toggle dark via tombol tema di topbar.
    await page.click('button[aria-label*="mode gelap"], button[aria-label*="mode terang"]').catch(() => {})
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/${target.name}-dark.png`, fullPage: false })
    // Kembali ke light untuk halaman berikutnya.
    await page.click('button[aria-label*="mode terang"], button[aria-label*="mode gelap"]').catch(() => {})
    await page.waitForTimeout(300)
  }

  await browser.close()
  console.log("screenshots done")
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
