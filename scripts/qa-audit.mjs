// TEMPORARY audit script — screenshot semua halaman admin.
import { chromium } from "playwright"

const BASE = "http://localhost:8200"
const OUT = "/tmp/admin-audit"
const pages = [
  ["dashboard", "/admin"],
  ["orders", "/admin/orders"],
  ["payments", "/admin/payments"],
  ["shipping", "/admin/shipping"],
  ["products", "/admin/products"],
  ["products-create", "/admin/products/create"],
  ["imports", "/admin/imports"],
  ["imports-create", "/admin/imports/create"],
  ["media", "/admin/media"],
  ["banners", "/admin/banners"],
  ["banners-create", "/admin/banners/create"],
  ["flash-sale", "/admin/flash-sale"],
  ["vouchers", "/admin/vouchers"],
  ["cod-settings", "/admin/cod-settings"],
  ["shipping-subsidy", "/admin/shipping-subsidy"],
  ["whatsapp-templates", "/admin/whatsapp/templates"],
  ["whatsapp-messages", "/admin/whatsapp/messages"],
  ["whatsapp-connection", "/admin/whatsapp/connection"],
  ["analytics-store", "/admin/analytics/store-performance"],
  ["analytics-import", "/admin/analytics/import-performance"],
  ["customers", "/admin/customers"],
  ["testimonials", "/admin/testimonials"],
  ["activity-logs", "/admin/activity-logs"],
  ["beranda", "/admin/beranda"],
  ["model-products", "/admin/model-products"],
  ["cara-pemesanan", "/admin/cara-pemesanan"],
  ["faq", "/admin/faq"],
  ["masalah-solusi", "/admin/masalah-solusi"],
  ["tentang-kami", "/admin/tentang-kami"],
  ["storefront-platforms", "/admin/storefront-platforms"],
  ["ketentuan-layanan", "/admin/ketentuan-layanan"],
  ["apa-kata-pelanggan", "/admin/apa-kata-pelanggan"],
  ["hasil-pemasangan", "/admin/hasil-pemasangan"],
  ["profile", "/admin/profile"],
  ["users", "/admin/users"],
  ["settings", "/admin/settings"],
]

const run = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
  await page.fill("#login-identifier", "qa.admin@example.com")
  await page.fill("#login-password", "QaScreenshot2026!")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin/, { timeout: 15000 })
  for (const [name, path] of pages) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 20000 })
      await page.waitForTimeout(350)
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
      console.log("ok", name)
    } catch (e) {
      console.log("FAIL", name, e.message?.slice(0, 80))
    }
  }
  await browser.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
