import { useCallback, useEffect, useState } from "react"

type AppStateDocument<T> = {
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
    const detail = await response.text().catch(() => "")
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
  const save = async () => {
    const existing = await findState<T>(key)
    if (existing) {
      await request(`/api/app-state/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ value, expectedUpdatedAt: existing.updatedAt }),
      })
      return
    }

    await request("/api/app-state", {
      method: "POST",
      body: JSON.stringify({ key, value }),
    })
  }

  try {
    await save()
  } catch (error) {
    // A concurrent first write or optimistic-lock conflict is safe to retry once.
    await save()
  }
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
  listeners.get(key)?.forEach(listener => listener(value))
}

export function usePayloadValue<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => (cache.get(key) as T | undefined) ?? fallback)
  const [loading, setLoading] = useState(!cache.has(key))

  const refresh = useCallback(async () => {
    try {
      const remote = await getPayloadValue(key, fallback)
      publish(key, remote)
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

  const update = useCallback((next: T | ((current: T) => T)) => {
    const current = (cache.get(key) as T | undefined) ?? value
    const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next
    publish(key, resolved)

    const existingTimer = writeTimers.get(key)
    if (existingTimer) window.clearTimeout(existingTimer)
    writeTimers.set(key, window.setTimeout(() => {
      void setPayloadValue(key, resolved)
    }, 400))
  }, [key, value])

  return { value, setValue: update, loading, refresh }
}
