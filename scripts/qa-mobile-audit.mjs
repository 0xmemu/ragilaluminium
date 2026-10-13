import { chromium } from "playwright"
import { writeFileSync, mkdirSync } from "node:fs"

const BASE = "http://localhost:8200"
const OUT = "/tmp/mobile-audit"
const VIEWPORT = { width: 360, height: 800 }

const pages = [
  ["home", "/"],
  ["catalog-windows", "/products/windows"],
  ["catalog-all", "/products/all"],
  ["pdp", "/product/SP58155312043"],
  ["cart", "/cart"],
  ["order-status", "/order/status"],
  ["flash-sale", "/flash-sale"],
  ["promo", "/promo"],
  ["cara-pemesanan", "/cara-pemesanan"],
  ["faq", "/faq"],
  ["hasil-pemasangan", "/hasil-pemasangan"],
  ["reviews", "/reviews"],
  ["masalah-solusi", "/masalah-dan-solusi"],
]

mkdirSync(OUT, { recursive: true })

const audit = async (page, name, path) => {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 25000 })
  await page.waitForTimeout(1200)

  const metrics = await page.evaluate(() => {
    const vw = window.innerWidth
    const doc = document.documentElement
    const overflowX = doc.scrollWidth - vw

    const wide = [...document.querySelectorAll("body *")]
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || "").slice(0, 60),
          right: Math.round(r.right),
          w: Math.round(r.width),
        }
      })
      .filter((e) => e.w > 4 && e.right > vw + 3)
      .sort((a, b) => b.right - a.right)
      .slice(0, 12)

    const clipped = [...document.querySelectorAll("h1,h2,h3,p,span,a,button,li,dt,dd")]
      .map((el) => {
        if (el.children.length) return null
        if (String(el.className || "").includes("sr-only")) return null
        const text = (el.textContent || "").trim()
        if (text.length < 2) return null
        const sw = el.scrollWidth
        const cw = el.clientWidth
        if (sw > cw + 2) {
          return {
            tag: el.tagName.toLowerCase(),
            cls: String(el.className || "").slice(0, 50),
            text: text.slice(0, 60),
            w: Math.round(cw),
          }
        }
        return null
      })
      .filter(Boolean)
      .slice(0, 8)

    const small = [...document.querySelectorAll("a,button,input,select,[role=button]")]
      .map((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return null
        const cs = getComputedStyle(el)
        if (cs.display === "none" || cs.visibility === "hidden") return null
        const w = Math.round(r.width)
        const h = Math.round(r.height)
        // Inline text links get a WCAG 2.2 exception; flag the rest.
        const isInlineTextLink = el.tagName === "A" && h < 40 && w > 100 && !String(el.className || "").match(/h-\d|min-h-\d|size-\d/)
        if ((w < 40 || h < 40) && !isInlineTextLink) {
          return {
            tag: el.tagName.toLowerCase(),
            cls: String(el.className || "").slice(0, 50),
            label:
              (el.textContent || "").trim().slice(0, 30) ||
              el.getAttribute("aria-label") ||
              el.getAttribute("title") ||
              "",
            w,
            h,
          }
        }
        return null
      })
      .filter(Boolean)
      .slice(0, 8)

    const fixed = [...document.querySelectorAll("body *")]
      .map((el) => {
        const cs = getComputedStyle(el)
        if (cs.position !== "fixed" && cs.position !== "sticky") return null
        if (String(el.className || "").includes("nprogress")) return null
        const r = el.getBoundingClientRect()
        return {
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || "").slice(0, 60),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          w: Math.round(r.width),
        }
      })
      .filter(Boolean)
      .slice(0, 6)

    const paint = performance
      .getEntriesByType("paint")
      .map((e) => `${e.name}:${Math.round(e.startTime)}ms`)

    const title = document.title

    return { vw, overflowX, wide, clipped, small, fixed, paint, title }
  })

  let axe = []
  try {
    const AxeBuilder = (await import("@axe-core/playwright")).default
    await page
      .locator(".bar[role='bar']")
      .waitFor({ state: "detached", timeout: 4000 })
      .catch(() => {})
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .exclude(".bar")
      .analyze()
    axe = results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact || ""))
      .map((v) => `${v.id}(${v.nodes.length})`)
  } catch (e) {
    axe = [`axe-error:${String(e.message || e).slice(0, 60)}`]
  }

  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`ok ${name} ${path} overflow=${metrics.overflowX}px`)
  return { name, path, ...metrics, axe }
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
const page = await context.newPage()
const results = []
for (const [name, path] of pages) {
  try {
    results.push(await audit(page, name, path))
  } catch (e) {
    console.log(`FAIL ${name} ${path}: ${String(e.message || e).slice(0, 90)}`)
    results.push({ name, path, error: String(e.message || e).slice(0, 120) })
  }
}
await browser.close()

writeFileSync(`${OUT}/report.json`, JSON.stringify(results, null, 2))
console.log("\n===== SUMMARY =====")
for (const r of results) {
  if (r.error) {
    console.log(`❌ ${r.name}: ERROR ${r.error}`)
    continue
  }
  const issues = []
  if (r.overflowX > 2) issues.push(`overflow+${r.overflowX}px`)
  if (r.wide.length) issues.push(`${r.wide.length} wide`)
  if (r.clipped.length) issues.push(`${r.clipped.length} clipped`)
  if (r.small.length) issues.push(`${r.small.length} small-tap`)
  if (r.fixed.length) issues.push(`fixed:${r.fixed.map((f) => f.cls.slice(0, 24)).join("|")}`)
  if (r.axe.length) issues.push(`axe:${r.axe.join(",")}`)
  console.log(`${issues.length ? "⚠️" : "✅"} ${r.name} ${r.path} — ${issues.join(" · ") || "clean"}`)
}
console.log("\nReport: " + OUT + "/report.json")
