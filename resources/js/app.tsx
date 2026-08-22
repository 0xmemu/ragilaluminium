import { createInertiaApp } from "@inertiajs/react"
import { createRoot } from "react-dom/client"
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers"
import { ErrorBoundary } from "./components/shared/error-boundary"

const appName = import.meta.env.VITE_APP_NAME || "Ragil Aluminium"

// Keep a reference so setup() can reuse the same glob for background preloading.
const pages = import.meta.glob("./pages/**/*.tsx")

createInertiaApp({
  title: (title) => (title ? `${title} | ${appName}` : appName),
  resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, pages),
  setup({ el, App, props }) {
    createRoot(el).render(
      <ErrorBoundary>
        <App {...props} />
      </ErrorBoundary>,
    )

    const preloadTargets = [
      "./pages/Public/Catalog.tsx",
      "./pages/Public/ProductDetail.tsx",
      "./pages/Public/Cart.tsx",
      "./pages/Public/Home.tsx",
      "./pages/Public/ModelDetail.tsx",
      "./pages/Admin/Dashboard.tsx",
      "./pages/Admin/Orders/Index.tsx",
      "./pages/Admin/Analytics/StorePerformance.tsx",
      "./pages/Admin/Products/Index.tsx",
      "./pages/Admin/Notifications.tsx",
      "./pages/Public/About.tsx",
      "./pages/Public/FAQ.tsx",
      "./pages/Public/OrderStatus.tsx",
      "./pages/Public/HowToOrder.tsx",
      "./pages/Public/ModelProduk.tsx",
      "./pages/Public/Reviews.tsx",
      "./pages/Public/InformasiToko.tsx",
      "./pages/Public/Installations.tsx",
      "./pages/Public/InstallationDetail.tsx",
      "./pages/Public/OrderConfirmation.tsx",
      "./pages/Public/Checkout.tsx",
      "./pages/Public/MasalahSolusi.tsx",
      "./pages/Public/CmsPage.tsx",
    ]

    const schedulePreload = () =>
      setTimeout(() => {
        preloadTargets.forEach((key) => {
          const loader = pages[key] as (() => Promise<unknown>) | undefined
          if (loader) void loader()
        })
      }, 500)

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
