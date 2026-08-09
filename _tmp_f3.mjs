import { chromium } from "playwright"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto("https://ra.333labs.tech/", { waitUntil: "networkidle", timeout: 60000 })
await page.waitForSelector("#promo", { timeout: 15000 })
await page.waitForTimeout(900)
const dots = await page.locator('#promo button[aria-label^="Slide"]').count()
// slide 1 (red) via dot
await page.locator('#promo button[aria-label="Slide 1"]').first().click()
await page.waitForTimeout(700)
const red = await page.evaluate(() => {
  const car = document.querySelector("#promo .overflow-hidden")
  const link = car.querySelector("a[href='/products/bouven']")
  return { bg: link ? getComputedStyle(link).backgroundColor : null, h: link ? Math.round(link.getBoundingClientRect().height) : null, text: car.innerText.replace(/\n+/g, " | ").slice(0, 80) }
})
// slide 2 (banner split) via last dot
await page.locator('#promo button[aria-label$="Slide"]').last().click()
await page.waitForTimeout(700)
const split = await page.evaluate(() => {
  const banner = document.querySelector("#promo .grid.grid-cols-2")
  return banner ? banner.innerText.replace(/\n+/g, " | ").slice(0, 120) : "NOT FOUND"
})
console.log("dots:", dots)
console.log("RED SLIDE:", JSON.stringify(red))
console.log("SPLIT SLIDE:", split)
await browser.close()
console.log("DONE")
