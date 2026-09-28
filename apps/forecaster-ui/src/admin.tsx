import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { getCurrentUser } from "./payload"

interface AdminContextValue {
  isAdmin: boolean
  pinConfigured: boolean
  loading: boolean
  email: string
  role: string
  unlock: (pin: string) => Promise<"ok" | "wrong" | "set">
  lock: () => void
}

const AdminContext = createContext<AdminContextValue>({
  isAdmin: false,
  pinConfigured: false,
  loading: true,
  email: "",
  role: "viewer",
  unlock: async () => "wrong",
  lock: () => {},
})

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("viewer")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentUser()
      .then(user => {
        const nextRole = user?.role ?? "viewer"
        setEmail(user?.email ?? "")
        setRole(nextRole)
        setIsAdmin(["planner", "approver", "admin"].includes(nextRole))
        setLoading(false)
      }, () => {
        setLoading(false)
      })
  }, [])

  async function unlock(pin: string): Promise<"ok" | "wrong" | "set"> {
    void pin
    return isAdmin ? "ok" : "wrong"
  }

  function lock() {
    // Access is controlled by the authenticated Figma role, not a browser PIN.
  }

  return (
    <AdminContext.Provider value={{ isAdmin, pinConfigured: true, loading, email, role, unlock, lock }}>
      {children}
    </AdminContext.Provider>
  )
}

export const useAdmin = () => useContext(AdminContext)
