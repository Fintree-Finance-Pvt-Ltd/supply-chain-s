export const ROLES = {
  ADMIN: 'admin',
  RELATIONSHIP_MANAGER: 'relationship_manager',
  CREDIT_TEAM: 'credit_team',
  OPERATIONS_TEAM: 'operations_team',
  CEO: 'ceo',
  CFO: 'cfo',
  MD: 'md',
}

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.RELATIONSHIP_MANAGER]: 'Relationship Manager',
  [ROLES.CREDIT_TEAM]: 'Credit Team',
  [ROLES.OPERATIONS_TEAM]: 'Operations Team',
  [ROLES.CEO]: 'CEO',
  [ROLES.CFO]: 'CFO',
  [ROLES.MD]: 'Managing Director',
}

export const MANAGEMENT_ROLES = [ROLES.CEO, ROLES.CFO, ROLES.MD]

