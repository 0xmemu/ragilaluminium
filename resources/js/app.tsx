import { createInertiaApp } from "@inertiajs/react"
import { createRoot } from "react-dom/client"
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers"

const appName = import.meta.env.VITE_APP_NAME || "Ragil Aluminium"

// Keep a reference so setup() can reuse the same glob for background preloading.
const pages = import.meta.glob("./pages/**/*.tsx")

createInertiaApp({
  title: (title) => (title ? `${title} | ${appName}` : appName),
  resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, pages),
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />)

    const preloadTargets = [
      "./pages/Public/Catalog.tsx",
      "./pages/Public/ProductDetail.tsx",
      "./pages/Public/Cart.tsx",
      "./pages/Public/Home.tsx",
      "./pages/Public/ModelDetail.tsx",
    ]

    const schedulePreload = () =>
      setTimeout(() => {
        preloadTargets.forEach((key) => {
          const loader = pages[key] as (() => Promise<unknown>) | undefined
          if (loader) void loader()
        })
      }, 3000)

    if (typeof window !== "undefined") {
      if (document.readyState === "complete") {
        schedulePreload()
      } else {
        window.addEventListener("load", schedulePreload, { once: true })
      }
    }
  },
  progress: {
    delay: 250,
    color: "#F5C518",
    includeCSS: false,
    showSpinner: false,
  },
})
