import { createContext, useContext, ReactNode } from "react"
import { useCollaboration, type WorkspaceRole } from "./collaboration"

interface AdminContextValue {
  isAdmin: boolean
  pinConfigured: boolean
  loading: boolean
  email: string
  role: WorkspaceRole
  accessMode: "shared-role"
  unlock: (pin: string) => Promise<"ok" | "wrong" | "set">
  lock: () => void
}

const AdminContext = createContext<AdminContextValue>({
  isAdmin: false,
  pinConfigured: false,
  loading: true,
  email: "",
  role: "viewer",
  accessMode: "shared-role",
  unlock: async () => "wrong",
  lock: () => {},
})

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user, role, loading, canContribute } = useCollaboration()
  const isAdmin = canContribute

  async function unlock(pin: string): Promise<"ok" | "wrong" | "set"> {
    void pin
    return isAdmin ? "ok" : "wrong"
  }

  function lock() {
    // Access is controlled by the authenticated Figma role, not a browser PIN.
  }

  return (
    <AdminContext.Provider value={{
      isAdmin,
      pinConfigured: true,
      loading,
      email: user?.email ?? "",
      role: role ?? "viewer",
      accessMode: "shared-role",
      unlock,
      lock,
    }}>
      {children}
    </AdminContext.Provider>
  )
}

export const useAdmin = () => useContext(AdminContext)
