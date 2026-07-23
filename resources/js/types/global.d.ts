import type { route as routeFn } from "ziggy-js"

declare global {
  var route: typeof routeFn

  interface Window {
    route: typeof routeFn
  }
}

export {}
