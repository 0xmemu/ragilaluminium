import { usePage } from "@inertiajs/react"

import type { SharedPageProps } from "@/types"

export interface AdminCapabilitiesPayload {
  version: number
  granular: boolean
  capabilities: Record<string, boolean>
}

/**
 * Baca capability admin dari props Inertia (auth.capabilities).
 * Fail-closed: tidak ada data → semua capability false.
 */
export function readAdminCapabilities(): AdminCapabilitiesPayload | null {
  try {
    const props = usePage<SharedPageProps>().props
    const auth = props.auth as { capabilities?: AdminCapabilitiesPayload | null } | undefined
    const payload = auth?.capabilities
    if (!payload || typeof payload !== "object" || !payload.capabilities) return null
    return payload
  } catch {
    return null
  }
}

/** Hook tunggal utk capability admin. */
export function useAdminCapabilities(): AdminCapabilitiesPayload | null {
  return readAdminCapabilities()
}

/** True bila user memiliki capability; fail-closed false. */
export function can(capability: string, payload?: AdminCapabilitiesPayload | null): boolean {
  return payload?.capabilities?.[capability] === true
}

/** True bila user memiliki SETIDAKNYA SATU dari capability. */
export function canAny(capabilities: string[], payload?: AdminCapabilitiesPayload | null): boolean {
  return capabilities.some((capability) => can(capability, payload))
}

/** True bila user memiliki SEMUA capability. */
export function canAll(capabilities: string[], payload?: AdminCapabilitiesPayload | null): boolean {
  return capabilities.every((capability) => can(capability, payload))
}

/** True bila capability domain apa pun (mis. "orders.*") ada. */
export function canDomain(domain: string, payload?: AdminCapabilitiesPayload | null): boolean {
  if (!payload?.capabilities) return false
  const prefix = `${domain}.`
  return Object.entries(payload.capabilities).some(
    ([capability, value]) => value === true && capability.startsWith(prefix),
  )
}
