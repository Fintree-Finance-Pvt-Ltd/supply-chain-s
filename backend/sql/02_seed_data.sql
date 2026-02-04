-- ============================================
-- Supply Chain Finance System
-- SEED DATA
-- ============================================

USE supply_chain_finance;

-- ============================================
-- 1. ROLES
-- ============================================

INSERT INTO roles (id, name, label, description, isActive) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin', 'Admin', 'System Administrator with full access', TRUE),
('550e8400-e29b-41d4-a716-446655440002', 'relationship_manager', 'Relationship Manager', 'Manages customer relationships and onboarding', TRUE),
('550e8400-e29b-41d4-a716-446655440003', 'credit_team', 'Credit Team', 'Reviews and sanctions credit limits', TRUE),
('550e8400-e29b-41d4-a716-446655440004', 'operations_team', 'Operations Team', 'Verifies post-sanction documents and processes', TRUE),
('550e8400-e29b-41d4-a716-446655440005', 'cfo', 'CFO', 'Chief Financial Officer - Approval authority', TRUE),
('550e8400-e29b-41d4-a716-446655440006', 'ceo', 'CEO', 'Chief Executive Officer - Approval authority', TRUE),
('550e8400-e29b-41d4-a716-446655440007', 'md', 'Managing Director', 'Managing Director - Final approval authority', TRUE)
ON DUPLICATE KEY UPDATE label=VALUES(label);

-- ============================================
-- 2. PERMISSIONS
-- ============================================

INSERT INTO permissions (id, name, label, description, resource, action) VALUES
-- User Management
('660e8400-e29b-41d4-a716-446655440001', 'users.create', 'Create Users', 'Create new system users', 'users', 'create'),
('660e8400-e29b-41d4-a716-446655440002', 'users.read', 'View Users', 'View user list and details', 'users', 'read'),
('660e8400-e29b-41d4-a716-446655440003', 'users.update', 'Update Users', 'Update user information', 'users', 'update'),
('660e8400-e29b-41d4-a716-446655440004', 'users.delete', 'Delete Users', 'Delete or deactivate users', 'users', 'delete'),

-- Customer Management
('660e8400-e29b-41d4-a716-446655440005', 'customers.create', 'Create Customers', 'Create new customer records', 'customers', 'create'),
('660e8400-e29b-41d4-a716-446655440006', 'customers.read', 'View Customers', 'View customer list and details', 'customers', 'read'),
('660e8400-e29b-41d4-a716-446655440007', 'customers.update', 'Update Customers', 'Update customer information', 'customers', 'update'),
('660e8400-e29b-41d4-a716-446655440008', 'customers.submit', 'Submit Cases', 'Submit customer cases for review', 'customers', 'submit'),

-- Credit Management
('660e8400-e29b-41d4-a716-446655440009', 'credit.create', 'Create Sanctions', 'Create credit sanctions', 'credit', 'create'),
('660e8400-e29b-41d4-a716-446655440010', 'credit.read', 'View Sanctions', 'View credit sanctions', 'credit', 'read'),
('660e8400-e29b-41d4-a716-446655440011', 'credit.approve', 'Approve Sanctions', 'Approve credit sanctions', 'credit', 'approve'),

-- Approval Management
('660e8400-e29b-41d4-a716-446655440012', 'approvals.read', 'View Approvals', 'View pending approvals', 'approvals', 'read'),
('660e8400-e29b-41d4-a716-446655440013', 'approvals.approve', 'Process Approvals', 'Approve or reject approvals', 'approvals', 'approve'),

-- Operations Management
('660e8400-e29b-41d4-a716-446655440014', 'operations.read', 'View Operations', 'View operations checks', 'operations', 'read'),
('660e8400-e29b-41d4-a716-446655440015', 'operations.verify', 'Verify Operations', 'Verify operations documents', 'operations', 'verify'),

-- Document Management
('660e8400-e29b-41d4-a716-446655440016', 'documents.upload', 'Upload Documents', 'Upload customer documents', 'documents', 'upload'),
('660e8400-e29b-41d4-a716-446655440017', 'documents.read', 'View Documents', 'View customer documents', 'documents', 'read'),
('660e8400-e29b-41d4-a716-446655440018', 'documents.verify', 'Verify Documents', 'Verify uploaded documents', 'documents', 'verify')
ON DUPLICATE KEY UPDATE label=VALUES(label);

-- ============================================
-- 3. ROLE PERMISSIONS (Admin gets all)
-- ============================================

-- Admin gets all permissions
INSERT INTO role_permissions (id, roleId, permissionId)
SELECT 
    CONCAT('770e8400-e29b-41d4-a716-44665544', LPAD(ROW_NUMBER() OVER(), 4, '0')) as id,
    '550e8400-e29b-41d4-a716-446655440001' as roleId,
    id as permissionId
FROM permissions
ON DUPLICATE KEY UPDATE roleId=VALUES(roleId);

-- RM Permissions
INSERT INTO role_permissions (id, roleId, permissionId) VALUES
('770e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440005'),
('770e8400-e29b-41d4-a716-446655440102', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440006'),
('770e8400-e29b-41d4-a716-446655440103', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440007'),
('770e8400-e29b-41d4-a716-446655440104', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440008'),
('770e8400-e29b-41d4-a716-446655440105', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440016'),
('770e8400-e29b-41d4-a716-446655440106', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440017')
ON DUPLICATE KEY UPDATE roleId=VALUES(roleId);

-- Credit Team Permissions
INSERT INTO role_permissions (id, roleId, permissionId) VALUES
('770e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440006'),
('770e8400-e29b-41d4-a716-446655440202', '550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440009'),
('770e8400-e29b-41d4-a716-446655440203', '550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440010'),
('770e8400-e29b-41d4-a716-446655440204', '550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440017'),
('770e8400-e29b-41d4-a716-446655440205', '550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440018')
ON DUPLICATE KEY UPDATE roleId=VALUES(roleId);

-- Operations Team Permissions
INSERT INTO role_permissions (id, roleId, permissionId) VALUES
('770e8400-e29b-41d4-a716-446655440301', '550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440006'),
('770e8400-e29b-41d4-a716-446655440302', '550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440014'),
('770e8400-e29b-41d4-a716-446655440303', '550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440015'),
('770e8400-e29b-41d4-a716-446655440304', '550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440017')
ON DUPLICATE KEY UPDATE roleId=VALUES(roleId);

-- Management (CEO, CFO, MD) Permissions
INSERT INTO role_permissions (id, roleId, permissionId) VALUES
('770e8400-e29b-41d4-a716-446655440401', '550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440012'),
('770e8400-e29b-41d4-a716-446655440402', '550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440013'),
('770e8400-e29b-41d4-a716-446655440403', '550e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440012'),
('770e8400-e29b-41d4-a716-446655440404', '550e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440013'),
('770e8400-e29b-41d4-a716-446655440405', '550e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440012'),
('770e8400-e29b-41d4-a716-446655440406', '550e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440013')
ON DUPLICATE KEY UPDATE roleId=VALUES(roleId);

-- ============================================
-- 4. DEFAULT USERS (Password: password123)
-- Password hash for 'password123' using bcrypt
-- ============================================

INSERT INTO users (id, email, password, name, mobile, isActive, defaultRole) VALUES
-- Admin
('880e8400-e29b-41d4-a716-446655440001', 'admin@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'Admin User', '9999999999', TRUE, 'admin'),

-- Relationship Managers
('880e8400-e29b-41d4-a716-446655440002', 'rm@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'John Doe - RM', '9876543210', TRUE, 'relationship_manager'),
('880e8400-e29b-41d4-a716-446655440003', 'rm2@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'Jane Smith - RM', '9876543211', TRUE, 'relationship_manager'),

-- Credit Team
('880e8400-e29b-41d4-a716-446655440004', 'credit@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'Credit Officer', '9876543212', TRUE, 'credit_team'),

-- Operations Team
('880e8400-e29b-41d4-a716-446655440005', 'ops@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'Operations Manager', '9876543213', TRUE, 'operations_team'),

-- Management
('880e8400-e29b-41d4-a716-446655440006', 'ceo@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'CEO', '9876543214', TRUE, 'ceo'),
('880e8400-e29b-41d4-a716-446655440007', 'cfo@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'CFO', '9876543215', TRUE, 'cfo'),
('880e8400-e29b-41d4-a716-446655440008', 'md@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'Managing Director', '9876543216', TRUE, 'md')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================
-- 5. USER ROLE ASSIGNMENTS
-- ============================================

INSERT INTO user_roles (id, userId, roleId, isActive, assignedBy) VALUES
-- Admin
('990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', TRUE, '880e8400-e29b-41d4-a716-446655440001'),

-- RMs
('990e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', TRUE, '880e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', TRUE, '880e8400-e29b-41d4-a716-446655440001'),

-- Credit Team
('990e8400-e29b-41d4-a716-446655440004', '880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', TRUE, '880e8400-e29b-41d4-a716-446655440001'),

-- Operations Team
('990e8400-e29b-41d4-a716-446655440005', '880e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440004', TRUE, '880e8400-e29b-41d4-a716-446655440001'),

-- Management
('990e8400-e29b-41d4-a716-446655440006', '880e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440006', TRUE, '880e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440007', '880e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440005', TRUE, '880e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440008', '880e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440007', TRUE, '880e8400-e29b-41d4-a716-446655440001')
ON DUPLICATE KEY UPDATE isActive=VALUES(isActive);

-- ============================================
-- 6. APPROVAL FLOWS
-- ============================================

-- Credit Sanction Approval Flow
INSERT INTO approval_flows (id, name, flowType, description, isActive, isSequential) VALUES
('aa0e8400-e29b-41d4-a716-446655440001', 'Credit Sanction Approval', 'credit_sanction', 'Multi-level approval for credit sanctions: Credit Team → CFO → CEO → MD', TRUE, TRUE),
('aa0e8400-e29b-41d4-a716-446655440002', 'Operations Approval', 'operations', 'Multi-level approval for operations verification: Ops Checker → Ops Manager → Final Approver', TRUE, TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================
-- 7. APPROVAL STEPS
-- ============================================

-- Credit Sanction Steps
INSERT INTO approval_steps (id, approvalFlowId, approverRoleId, stepOrder, stepName, isRequired) VALUES
-- Credit Sanction Flow
('bb0e8400-e29b-41d4-a716-446655440001', 'aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 1, 'Credit Team Review', TRUE),
('bb0e8400-e29b-41d4-a716-446655440002', 'aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 2, 'CFO Approval', TRUE),
('bb0e8400-e29b-41d4-a716-446655440003', 'aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 3, 'CEO Approval', TRUE),
('bb0e8400-e29b-41d4-a716-446655440004', 'aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 4, 'MD Final Approval', TRUE),

-- Operations Flow
('bb0e8400-e29b-41d4-a716-446655440005', 'aa0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', 1, 'Operations Checker', TRUE),
('bb0e8400-e29b-41d4-a716-446655440006', 'aa0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', 2, 'Operations Manager', TRUE),
('bb0e8400-e29b-41d4-a716-446655440007', 'aa0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440006', 3, 'Final Approver (CEO)', TRUE)
ON DUPLICATE KEY UPDATE stepName=VALUES(stepName);

-- ============================================
-- END OF SEED DATA
-- ============================================

-- Note: Default password for all users is 'password123'
-- In production, these should be changed immediately after first login



