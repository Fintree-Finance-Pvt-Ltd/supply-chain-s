export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  RELATIONSHIP_MANAGER: 'relationship_manager',
  CREDIT_TEAM: 'credit_team',
  CREDIT_TEAM_L1: 'credit_team_l1',
  CREDIT_TEAM_L2: 'credit_team_l2',
  CREDIT_HEAD: 'credit_head',
  OPERATIONS_TEAM: 'operations_team',
  OPERATIONS_TEAM_L1: 'operations_team_l1',
  OPERATIONS_TEAM_L2: 'operations_team_l2',
  OPERATIONS_HEAD: 'operations_head',
  CEO: 'ceo',
  CFO: 'cfo',
  MD: 'md',
  CUSTOMER: 'customer',
}

export const ROLE_LABELS = {
  [ROLES.SUPERADMIN]: 'Super Administrator',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.RELATIONSHIP_MANAGER]: 'Relationship Manager',
  [ROLES.CREDIT_TEAM]: 'Credit Team',
  [ROLES.CREDIT_TEAM_L1]: 'Credit Team L1',
  [ROLES.CREDIT_TEAM_L2]: 'Credit Team L2',
  [ROLES.CREDIT_HEAD]: 'Credit Head',
  [ROLES.OPERATIONS_TEAM]: 'Operations Team',
  [ROLES.OPERATIONS_TEAM_L1]: 'Operations Team L1',
  [ROLES.OPERATIONS_TEAM_L2]: 'Operations Team L2',
  [ROLES.OPERATIONS_HEAD]: 'Operations Head',
  [ROLES.CEO]: 'CEO',
  [ROLES.CFO]: 'CFO',
  [ROLES.MD]: 'Managing Director',
  [ROLES.CUSTOMER]: 'Customer',
}

export const MANAGEMENT_ROLES = [ROLES.CEO, ROLES.CFO, ROLES.MD]

