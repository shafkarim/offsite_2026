export type WorkspaceRole = "viewer" | "contributor" | "approver" | "admin"

export interface RoleCapabilities {
  canContribute: boolean
  canApprove: boolean
  canManage: boolean
}

export function capabilitiesForRole(
  role: WorkspaceRole | null,
  shared: boolean,
): RoleCapabilities {
  if (!shared) {
    return { canContribute: true, canApprove: true, canManage: true }
  }

  return {
    canContribute:
      role === "contributor" || role === "approver" || role === "admin",
    canApprove: role === "approver" || role === "admin",
    canManage: role === "admin",
  }
}

export function roleLabel(role: WorkspaceRole | null): string {
  if (!role) return "Local preview"
  return role.charAt(0).toUpperCase() + role.slice(1)
}
