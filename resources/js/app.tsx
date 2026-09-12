import { createInertiaApp } from "@inertiajs/react"
import { createRoot } from "react-dom/client"
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers"
import { ErrorBoundary } from "./components/shared/error-boundary"
import { adminShellLayout } from "./layouts/admin-layout"
import { publicShellLayout } from "./layouts/public-layout"

const appName = import.meta.env.VITE_APP_NAME || "Ragil Aluminium"

// Keep a reference so setup() can reuse the same glob for background preloading.
const pages = import.meta.glob("./pages/**/*.tsx")

createInertiaApp({
  title: (title) => (title ? `${title} | ${appName}` : appName),
  resolve: async (name) => {
    const module = await resolvePageComponent(`./pages/${name}.tsx`, pages)
    const component = (module as { default?: unknown }).default ?? module

    // Persistent layout admin: sidebar, header, bell notifikasi, dan state tema
    // tidak dibongkar saat pindah menu. Halaman tetap memakai <AdminLayout>
    // sendiri, yang otomatis hanya merender frame isi karena sudah di dalam shell.
    if (name.startsWith("Admin/")) {
      const target = component as { layout?: unknown }
      if (!target.layout) target.layout = adminShellLayout
    }

    // Persistent layout publik: header, pengumuman, keranjang terbang, footer,
    // dan bottom nav tidak dibongkar saat berpindah halaman. Halaman tetap
    // memakai <PublicLayout> sendiri yang otomatis hanya merender frame <main>
    // karena sudah berada di dalam shell.
    if (name.startsWith("Public/")) {
      const target = component as { layout?: unknown }
      if (!target.layout) target.layout = publicShellLayout
    }

    return component as never
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <ErrorBoundary>
        <App {...props} />
      </ErrorBoundary>,
    )

    // Preload HANYA area yang sedang dibuka, dan dijalankan saat browser idle.
    // Sebelumnya 21 halaman admin + publik diunduh serentak 500 ms setelah load
    // (77 file / sekitar 1,4 MB) sehingga navigasi jadi 2,7x lebih lambat bila
    // admin langsung mengklik menu. Halaman lain tetap ter-prefetch saat hover
    // lewat <Link prefetch> di navigasi, kartu produk, dan header.
    const initialComponent = String(props.initialPage.component ?? "")
    const targets = initialComponent.startsWith("Admin/")
      ? [
          "./pages/Admin/Dashboard.tsx",
          "./pages/Admin/Orders/Index.tsx",
          "./pages/Admin/Products/Index.tsx",
        ]
      : [
          "./pages/Public/Catalog.tsx",
          "./pages/Public/ProductDetail.tsx",
          "./pages/Public/Cart.tsx",
        ]

    const runPreload = () => {
      targets.forEach((key) => {
        const loader = pages[key] as (() => Promise<unknown>) | undefined
        if (loader) void loader()
      })
    }

    const schedulePreload = () => {
      const idle = (
        window as Window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void
        }
      ).requestIdleCallback

      if (typeof idle === "function") idle(runPreload, { timeout: 3000 })
      else setTimeout(runPreload, 2000)
    }

    if (typeof window !== "undefined") {
      if (document.readyState === "complete") {
        schedulePreload()
      } else {
        window.addEventListener("load", schedulePreload, { once: true })
      }
    }
  },
  progress: {
    delay: 100,
    color: "#F5C518",
    includeCSS: false,
    showSpinner: false,
  },
})
