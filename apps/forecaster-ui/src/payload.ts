import { useCallback, useEffect, useRef, useState } from "react"

type AppStateDocument<T,> = {
  id: string | number
  key: string
  value: T
  updatedAt?: string
}

type ListResponse<T> = { docs: T[] }

export type FigmaUser = {
  id: string | number
  email: string
  displayName?: string
  role?: "viewer" | "planner" | "approver" | "admin"
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const raw = await response.text().catch(() => "")
    let detail = raw
    try {
      const parsed = JSON.parse(raw) as {
        message?: string
        errors?: Array<{ message?: string }>
      }
      detail = parsed.message ?? parsed.errors?.[0]?.message ?? raw
    } catch {
      // The response is not JSON; keep the bounded text returned by Payload.
    }
    throw new Error(detail || `Payload request failed (${response.status})`)
  }

  return response.json() as Promise<T>
}

async function findState<T>(key: string): Promise<AppStateDocument<T> | null> {
  const encoded = encodeURIComponent(key)
  const result = await request<ListResponse<AppStateDocument<T>>>(
    `/api/app-state?limit=1&depth=0&where[key][equals]=${encoded}`,
  )
  return result.docs[0] ?? null
}

export async function getPayloadValue<T>(key: string, fallback: T): Promise<T> {
  const doc = await findState<T>(key)
  return doc?.value ?? fallback
}

export async function setPayloadValue<T>(key: string, value: T): Promise<void> {
  const existing = await findState<T>(key)
  if (existing) {
    await request(`/api/app-state/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ value, expectedUpdatedAt: existing.updatedAt }),
    })
    return
  }

  // Do not blindly retry a conflict: a second write of the same whole-state
  // value could overwrite another planner's newer changes. Let the caller show
  // the conflict and refresh the latest shared state instead.
  await request("/api/app-state", {
    method: "POST",
    body: JSON.stringify({ key, value }),
  })
}

export async function getCurrentUser(): Promise<FigmaUser | null> {
  const result = await request<{ user?: FigmaUser | null }>("/api/users/me")
  return result.user ?? null
}

const cache = new Map<string, unknown>()
const listeners = new Map<string, Set<(value: unknown) => void>>()
const writeTimers = new Map<string, number>()

function publish<T>(key: string, value: T) {
  cache.set(key, value)
  listeners.get(key)?.forEach((listener) => listener(value))
}

export function usePayloadValue<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(
    () => cache.get(key) as T | undefined ?? fallback,
  )
  const [loading, setLoading] = useState(!cache.has(key))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const latestValue = useRef(value)
  const fallbackValue = useRef(fallback)

  useEffect(() => {
    latestValue.current = value
  }, [value])

  const refresh = useCallback(async () => {
    try {
      const remote = await getPayloadValue(key, fallbackValue.current)
      publish(key, remote)
      setSaveError(null)
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The shared plan could not be loaded.",
      )
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    const listener = (next: unknown) => setValue(next as T)
    const keyListeners = listeners.get(key) ?? new Set()
    keyListeners.add(listener)
    listeners.set(key, keyListeners)

    void refresh()
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, 15_000)

    return () => {
      window.clearInterval(interval)
      keyListeners.delete(listener)
    }
  }, [key, refresh])

  const save = useCallback(
    async (nextValue: T) => {
      setSaving(true)
      setSaveError(null)
      try {
        await setPayloadValue(key, nextValue)
        setLastSavedAt(new Date().toISOString())
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? error.message
            : "The shared plan could not be saved.",
        )
      } finally {
        setSaving(false)
      }
    },
    [key],
  )

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = cache.get(key) as T | undefined ?? value
      let resolved: T
      if (typeof next === "function") {
        const updater = next as (current: T) => T
        resolved = updater(current)
      } else {
        resolved = next
      }
      latestValue.current = resolved
      publish(key, resolved)
      setSaving(true)
      setSaveError(null)

      const existingTimer = writeTimers.get(key)
      if (existingTimer) window.clearTimeout(existingTimer)
      writeTimers.set(
        key,
        window.setTimeout(() => {
          void save(resolved)
        }, 400),
      )
    },
    [key, save, value],
  )

  const retrySave = useCallback(() => save(latestValue.current), [save])

  return {
    value,
    setValue: update,
    loading,
    saving,
    saveError,
    lastSavedAt,
    refresh,
    retrySave,
  }
}
