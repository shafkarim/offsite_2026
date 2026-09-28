export type PacingDeliveryStatus =
  | "checking"
  | "ready"
  | "not-deployed"
  | "unavailable"

interface DeliveryError {
  code?: string | null
  message?: string | null
}

export function classifyPacingDeliveryError(
  error: DeliveryError | null,
): Exclude<PacingDeliveryStatus, "checking"> {
  if (!error) return "ready"

  const message = (error.message ?? "").toLowerCase()
  if (
    error.code === "PGRST205" ||
    message.includes("could not find the table 'public.pacing_snapshots'")
  ) {
    return "not-deployed"
  }

  // An anonymous permission error proves the table exists while preserving RLS.
  if (
    error.code === "42501" ||
    message.includes("permission denied for table pacing_snapshots")
  ) {
    return "ready"
  }

  return "unavailable"
}

