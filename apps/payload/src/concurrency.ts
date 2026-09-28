import { APIError, type CollectionBeforeChangeHook, type Field } from 'payload'

export const optimisticConcurrencyField: Field = {
  name: 'expectedUpdatedAt',
  type: 'text',
  virtual: true,
  admin: {
    hidden: true,
  },
}

export const enforceOptimisticConcurrency: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (operation !== 'update') return data

  const expectedUpdatedAt = (data as Record<string, unknown>).expectedUpdatedAt
  const currentUpdatedAt = (originalDoc as Record<string, unknown> | undefined)?.updatedAt

  if (
    typeof expectedUpdatedAt === 'string' &&
    typeof currentUpdatedAt === 'string' &&
    expectedUpdatedAt !== currentUpdatedAt
  ) {
    throw new APIError(
      'This record was updated by another user. Load the latest version before saving again.',
      409,
      { currentUpdatedAt },
      true,
    )
  }

  delete (data as Record<string, unknown>).expectedUpdatedAt
  return data
}
