import { chromium } from "playwright"
const BASE = "http://localhost:8200"
const OUT = "/tmp/audit-full"
const pages = [
  ["01-dashboard", "/admin"],
  ["02-orders", "/admin/orders"],
  ["03-payments", "/admin/payments"],
  ["04-shipping", "/admin/shipping"],
  ["05-products", "/admin/products"],
  ["06-products-create", "/admin/products/create"],
  ["07-imports", "/admin/imports"],
  ["08-imports-create", "/admin/imports/create"],
  ["09-media", "/admin/media"],
  ["10-banners", "/admin/banners"],
  ["11-banners-create", "/admin/banners/create"],
  ["12-flash-sale", "/admin/flash-sale"],
  ["13-vouchers", "/admin/vouchers"],
  ["14-vouchers-create", "/admin/vouchers/create"],
  ["15-cod-settings", "/admin/cod-settings"],
  ["16-shipping-subsidy", "/admin/shipping-subsidy"],
  ["17-whatsapp-templates", "/admin/whatsapp/templates"],
  ["18-whatsapp-messages", "/admin/whatsapp/messages"],
  ["19-whatsapp-connection", "/admin/whatsapp/connection"],
  ["20-analytics-store", "/admin/analytics/store-performance"],
  ["21-analytics-import", "/admin/analytics/import-performance"],
  ["22-customers", "/admin/customers"],
  ["23-testimonials", "/admin/testimonials"],
  ["24-testimonials-create", "/admin/testimonials/create"],
  ["25-activity-logs", "/admin/activity-logs"],
  ["26-beranda", "/admin/beranda"],
  ["27-model-products", "/admin/model-products"],
  ["28-cara-pemesanan", "/admin/cara-pemesanan"],
  ["29-faq", "/admin/faq"],
  ["30-masalah-solusi", "/admin/masalah-solusi"],
  ["31-tentang-kami", "/admin/tentang-kami"],
  ["32-storefront-platforms", "/admin/storefront-platforms"],
  ["33-ketentuan-layanan", "/admin/ketentuan-layanan"],
  ["34-apa-kata-pelanggan", "/admin/apa-kata-pelanggan"],
  ["35-hasil-pemasangan", "/admin/hasil-pemasangan"],
  ["36-profile", "/admin/profile"],
  ["37-users", "/admin/users"],
  ["38-users-create", "/admin/users/create"],
  ["39-settings", "/admin/settings"],
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
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 })
      await page.waitForTimeout(800)
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
      console.log("ok", name)
    } catch (e) {
      console.log("FAIL", name, e.message?.slice(0, 70))
    }
  }
  await browser.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
