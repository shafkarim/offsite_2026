import type { Access, FieldAccess } from 'payload'

export type ForecastRole = 'viewer' | 'planner' | 'approver' | 'admin'

type UserWithRole = {
  id?: string | number
  role?: ForecastRole
}

export const roleOf = (user: unknown): ForecastRole | undefined =>
  (user as UserWithRole | null | undefined)?.role

export const isAdminUser = (user: unknown): boolean => roleOf(user) === 'admin'

export const authenticated: Access = ({ req }) => Boolean(req.user)

export const plannerOrAbove: Access = ({ req }) =>
  ['planner', 'approver', 'admin'].includes(roleOf(req.user) ?? '')

export const approverOrAbove: Access = ({ req }) =>
  ['approver', 'admin'].includes(roleOf(req.user) ?? '')

export const adminOnly: Access = ({ req }) => isAdminUser(req.user)

export const fieldApproverOrAbove: FieldAccess = ({ req }) =>
  ['approver', 'admin'].includes(roleOf(req.user) ?? '')
