import { chromium } from "playwright"
const browser = await chromium.launch()
for (const w of [320, 360, 390, 414, 1280]) {
  const page = await browser.newPage({ viewport: { width: w, height: 800 } })
  await page.goto("https://ra.333labs.tech/", { waitUntil: "networkidle", timeout: 60000 })
  await page.waitForSelector("#promo", { timeout: 15000 })
  await page.waitForTimeout(900)
  const r = await page.evaluate(() => {
    const car = document.querySelector("#promo .overflow-hidden")
    const banner = document.querySelector("#promo .grid.grid-cols-2")
    if (!banner) return { strip: null, zones: null, divider: null, overflow: null, borders: null }
    const carR = car.getBoundingClientRect()
    const bannerR = banner.getBoundingClientRect()
    const zones = [...banner.children].map((z) => {
      const b = z.getBoundingClientRect()
      return { w: Math.round(b.width), h: Math.round(b.height), over: z.scrollHeight - z.clientHeight }
    })
    // cek apakah masih ada border/shadow kartu per zona
    const zoneStyle = getComputedStyle(banner.firstElementChild)
    return {
      strip: Math.round(carR.height),
      bannerFillsSlide: Math.abs(bannerR.width - carR.width) < 2 && Math.abs(bannerR.height - carR.height) < 2,
      zones,
      zoneBorder: zoneStyle.borderTopWidth + " " + zoneStyle.boxShadow.slice(0, 20),
      divider: getComputedStyle(banner.children[1]).borderLeftWidth,
      text: banner.innerText.replace(/\n+/g, " | ").slice(0, 160),
    }
  })
  console.log(w, "px ->", JSON.stringify(r))
  if (w === 390) await page.screenshot({ path: "/root/ragilaluminium/storage/app/audit-evidence/2026-08-08/promo-banner/satu-banner-mobile.png" })
  if (w === 1280) await page.screenshot({ path: "/root/ragilaluminium/storage/app/audit-evidence/2026-08-08/promo-banner/satu-banner-desktop.png" })
  await page.close()
}
await browser.close()
console.log("DONE")
