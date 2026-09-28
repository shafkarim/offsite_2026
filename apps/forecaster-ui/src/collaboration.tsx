import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { getCurrentUser, type FigmaUser } from "./payload"
import {
  capabilitiesForRole,
  roleLabel,
  type WorkspaceRole,
} from "./data/collaboration-model"

export type { WorkspaceRole } from "./data/collaboration-model"
export { roleLabel } from "./data/collaboration-model"

export interface WorkspaceSummary {
  id: string
  name: string
  slug: string
}

export interface WorkspaceMember {
  id: string
  name: string
  role: WorkspaceRole
  online: boolean
}

interface CollaborationContextValue {
  user: FigmaUser | null
  profileName: string
  workspace: WorkspaceSummary | null
  role: WorkspaceRole | null
  members: WorkspaceMember[]
  onlineCount: number
  loading: boolean
  schemaReady: boolean
  isShared: boolean
  canContribute: boolean
  canApprove: boolean
  canManage: boolean
  notice: string | null
  signIn: (email: string) => Promise<string | null>
  signOut: () => Promise<void>
  createWorkspace: (name: string) => Promise<string | null>
  inviteMember: (email: string, role: WorkspaceRole) => Promise<string | null>
  updateProfileName: (name: string) => Promise<string | null>
  refreshWorkspace: () => Promise<void>
}

const PAYLOAD_WORKSPACE: WorkspaceSummary = {
  id: "figma-payload-staging",
  name: "Figma FY26 forecast",
  slug: "figma-fy26-forecast",
}

function workspaceRoleFor(role: FigmaUser["role"]): WorkspaceRole {
  if (role === "admin") return "admin"
  if (role === "approver") return "approver"
  if (role === "planner") return "contributor"
  return "viewer"
}

function displayNameFor(user: FigmaUser): string {
  return user.displayName?.trim() || user.email.split("@")[0] || "Figma teammate"
}

const CollaborationContext = createContext<CollaborationContextValue>({
  user: null,
  profileName: "Figma teammate",
  workspace: null,
  role: null,
  members: [],
  onlineCount: 0,
  loading: true,
  schemaReady: false,
  isShared: false,
  canContribute: false,
  canApprove: false,
  canManage: false,
  notice: null,
  signIn: async () => "Figma staging controls sign-in through Okta.",
  signOut: async () => {},
  createWorkspace: async () => "The Payload workspace is already provisioned.",
  inviteMember: async () => "Manage staging access through the approved Figma access workflow.",
  updateProfileName: async () => "Profile editing is unavailable.",
  refreshWorkspace: async () => {},
})

type UsersResponse = {
  docs?: Array<{
    id: string | number
    email: string
    displayName?: string
    role?: FigmaUser["role"]
  }>
}

export function CollaborationProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FigmaUser | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const refreshWorkspace = useCallback(async () => {
    setLoading(true)
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      if (!currentUser) {
        setMembers([])
        setNotice("Figma staging authentication is required to open the shared forecast workspace.")
        return
      }

      const response = await fetch("/api/users?limit=100&depth=0", {
        credentials: "include",
        cache: "no-store",
      })
      if (!response.ok) throw new Error(`Team roster unavailable (${response.status})`)
      const body = (await response.json()) as UsersResponse
      setMembers((body.docs ?? []).map((member) => ({
        id: String(member.id),
        name: member.displayName?.trim() || member.email.split("@")[0],
        role: workspaceRoleFor(member.role),
        online: String(member.id) === String(currentUser.id),
      })))
      setNotice(null)
    } catch (error) {
      setMembers([])
      setNotice(error instanceof Error ? error.message : "The shared Payload workspace could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshWorkspace()
  }, [refreshWorkspace])

  const role = user ? workspaceRoleFor(user.role) : null
  const isShared = Boolean(user)
  const capabilities = capabilitiesForRole(role, isShared)
  const profileName = user ? displayNameFor(user) : "Figma teammate"

  async function updateProfileName(name: string): Promise<string | null> {
    if (!user) return "Figma staging authentication is required."
    const cleanName = name.trim()
    if (!cleanName) return "Enter a display name."
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: cleanName }),
    })
    if (!response.ok) return `Profile update failed (${response.status}).`
    setUser({ ...user, displayName: cleanName })
    setMembers((current) => current.map((member) =>
      member.id === String(user.id) ? { ...member, name: cleanName } : member,
    ))
    return null
  }

  const value = useMemo<CollaborationContextValue>(() => ({
    user,
    profileName,
    workspace: user ? PAYLOAD_WORKSPACE : null,
    role,
    members,
    onlineCount: user ? 1 : 0,
    loading,
    schemaReady: Boolean(user),
    isShared,
    ...capabilities,
    notice,
    signIn: async () => "You are already signed in through Figma staging. Refresh the page if your session changed.",
    signOut: async () => {
      setNotice("Sign-out is managed by your Figma staging session.")
    },
    createWorkspace: async () => "The shared Payload workspace is already provisioned.",
    inviteMember: async () => "Manage access in the Payload Users admin or the approved Figma access workflow.",
    updateProfileName,
    refreshWorkspace,
  }), [capabilities, isShared, loading, members, notice, profileName, role, user, refreshWorkspace])

  return <CollaborationContext.Provider value={value}>{children}</CollaborationContext.Provider>
}

export const useCollaboration = () => useContext(CollaborationContext)
