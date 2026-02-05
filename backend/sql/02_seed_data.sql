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
('550e8400-e29b-41d4-a716-446655440008', 'credit_team_l1', 'Credit Team L1', 'Credit Team Level 1 - Initial review', TRUE),
('550e8400-e29b-41d4-a716-446655440009', 'credit_team_l2', 'Credit Team L2', 'Credit Team Level 2 - Secondary review', TRUE),
('550e8400-e29b-41d4-a716-446655440010', 'operations_team_l1', 'Operations Team L1', 'Operations Team Level 1 - Document verification', TRUE),
('550e8400-e29b-41d4-a716-446655440011', 'operations_team_l2', 'Operations Team L2', 'Operations Team Level 2 - Further verification', TRUE),
('550e8400-e29b-41d4-a716-446655440012', 'operations_head', 'Operations Head', 'Operations Head - Final operations approval', TRUE),
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

-- Credit Team L1 Permissions
INSERT INTO role_permissions (id, roleId, permissionId) VALUES
('770e8400-e29b-41d4-a716-446655440208', '550e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440006'),
('770e8400-e29b-41d4-a716-446655440209', '550e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440009'),
('770e8400-e29b-41d4-a716-446655440210', '550e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440010'),
('770e8400-e29b-41d4-a716-446655440211', '550e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440017'),
('770e8400-e29b-41d4-a716-446655440212', '550e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440018')
ON DUPLICATE KEY UPDATE roleId=VALUES(roleId);

-- Credit Team L2 Permissions
INSERT INTO role_permissions (id, roleId, permissionId) VALUES
('770e8400-e29b-41d4-a716-446655440213', '550e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440006'),
('770e8400-e29b-41d4-a716-446655440214', '550e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440009'),
('770e8400-e29b-41d4-a716-446655440215', '550e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440010'),
('770e8400-e29b-41d4-a716-446655440216', '550e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440011'),
('770e8400-e29b-41d4-a716-446655440217', '550e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440017'),
('770e8400-e29b-41d4-a716-446655440218', '550e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440018')
ON DUPLICATE KEY UPDATE roleId=VALUES(roleId);

-- Operations Team L1 Permissions
INSERT INTO role_permissions (id, roleId, permissionId) VALUES
('770e8400-e29b-41d4-a716-446655440219', '550e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440006'),
('770e8400-e29b-41d4-a716-446655440220', '550e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440014'),
('770e8400-e29b-41d4-a716-446655440221', '550e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440015'),
('770e8400-e29b-41d4-a716-446655440222', '550e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440017')
ON DUPLICATE KEY UPDATE roleId=VALUES(roleId);

-- Operations Team L2 Permissions
INSERT INTO role_permissions (id, roleId, permissionId) VALUES
('770e8400-e29b-41d4-a716-446655440223', '550e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440006'),
('770e8400-e29b-41d4-a716-446655440224', '550e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440014'),
('770e8400-e29b-41d4-a716-446655440225', '550e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440015'),
('770e8400-e29b-41d4-a716-446655440226', '550e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440013'),
('770e8400-e29b-41d4-a716-446655440227', '550e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440017')
ON DUPLICATE KEY UPDATE roleId=VALUES(roleId);

-- Operations Head Permissions
INSERT INTO role_permissions (id, roleId, permissionId) VALUES
('770e8400-e29b-41d4-a716-446655440228', '550e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440006'),
('770e8400-e29b-41d4-a716-446655440229', '550e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440014'),
('770e8400-e29b-41d4-a716-446655440230', '550e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440015'),
('770e8400-e29b-41d4-a716-446655440231', '550e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440012'),
('770e8400-e29b-41d4-a716-446655440232', '550e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440013'),
('770e8400-e29b-41d4-a716-446655440233', '550e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440017')
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

-- Credit Team L1
('880e8400-e29b-41d4-a716-446655440009', 'credit_l1@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'Credit Officer L1', '9876543217', TRUE, 'credit_team_l1'),

-- Credit Team L2
('880e8400-e29b-41d4-a716-446655440010', 'credit_l2@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'Credit Officer L2', '9876543218', TRUE, 'credit_team_l2'),

-- Operations Team L1
('880e8400-e29b-41d4-a716-446655440011', 'ops_l1@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'Operations Officer L1', '9876543219', TRUE, 'operations_team_l1'),

-- Operations Team L2
('880e8400-e29b-41d4-a716-446655440012', 'ops_l2@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'Operations Officer L2', '9876543220', TRUE, 'operations_team_l2'),

-- Operations Head
('880e8400-e29b-41d4-a716-446655440013', 'ops_head@scf.com', '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'Operations Head', '9876543221', TRUE, 'operations_head'),

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

-- Credit Team L1
('990e8400-e29b-41d4-a716-446655440009', '880e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440008', TRUE, '880e8400-e29b-41d4-a716-446655440001'),

-- Credit Team L2
('990e8400-e29b-41d4-a716-446655440010', '880e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440009', TRUE, '880e8400-e29b-41d4-a716-446655440001'),

-- Operations Team L1
('990e8400-e29b-41d4-a716-446655440011', '880e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440010', TRUE, '880e8400-e29b-41d4-a716-446655440001'),

-- Operations Team L2
('990e8400-e29b-41d4-a716-446655440012', '880e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440011', TRUE, '880e8400-e29b-41d4-a716-446655440001'),

-- Operations Head
('990e8400-e29b-41d4-a716-446655440013', '880e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440012', TRUE, '880e8400-e29b-41d4-a716-446655440001'),

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
('aa0e8400-e29b-41d4-a716-446655440001', 'Credit Sanction Customer Approval', 'credit_sanction', 'Credit Sanction Approval: Credit Team L1 → Credit Team L2 → CEO → Managing Director', TRUE, TRUE),
('aa0e8400-e29b-41d4-a716-446655440002', 'Operations Approval for Customer', 'operations', 'Operations Approval: Operations Team L1 → Operations Head', TRUE, TRUE),
('aa0e8400-e29b-41d4-a716-446655440003', 'Invoice Discounting Flow', 'invoice_discounting', 'Invoice Discounting: Customer → Operation L1 → L2 → Operation Head → CEO → Managing Director', TRUE, TRUE),
('aa0e8400-e29b-41d4-a716-446655440004', 'Supplier Onboard Flow', 'supplier_onboard', 'Supplier Onboarding: Operation L1 → Operation Head', TRUE, TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================
-- 7. APPROVAL STEPS
-- ============================================

-- Credit Sanction Customer Approval Flow Steps
INSERT INTO approval_steps (id, approvalFlowId, approverRoleId, stepOrder, stepName, isRequired) VALUES
('bb0e8400-e29b-41d4-a716-446655440001', 'aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', 1, 'Credit Team L1 Review', TRUE),
('bb0e8400-e29b-41d4-a716-446655440002', 'aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440009', 2, 'Credit Team L2 Review', TRUE),
('bb0e8400-e29b-41d4-a716-446655440003', 'aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 3, 'CEO Approval', TRUE),
('bb0e8400-e29b-41d4-a716-446655440004', 'aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 4, 'Managing Director Final Approval', TRUE),

-- Operations Approval for Customer Flow Steps
('bb0e8400-e29b-41d4-a716-446655440005', 'aa0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440010', 1, 'Operations Team L1 Verification', TRUE),
('bb0e8400-e29b-41d4-a716-446655440006', 'aa0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440012', 2, 'Operations Head Done', TRUE),

-- Invoice Discounting Flow Steps
('bb0e8400-e29b-41d4-a716-446655440007', 'aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440010', 1, 'Operation L1 Review', TRUE),
('bb0e8400-e29b-41d4-a716-446655440008', 'aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440011', 2, 'Operation L2 Review', TRUE),
('bb0e8400-e29b-41d4-a716-446655440009', 'aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440012', 3, 'Operation Head Approval', TRUE),
('bb0e8400-e29b-41d4-a716-446655440010', 'aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440006', 4, 'CEO Approval', TRUE),
('bb0e8400-e29b-41d4-a716-446655440011', 'aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440007', 5, 'Managing Director Approval', TRUE),

-- Supplier Onboard Flow Steps
('bb0e8400-e29b-41d4-a716-446655440012', 'aa0e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440010', 1, 'Operation L1 Onboarding', TRUE),
('bb0e8400-e29b-41d4-a716-446655440013', 'aa0e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440012', 2, 'Operation Head Approval', TRUE)
ON DUPLICATE KEY UPDATE stepName=VALUES(stepName);

-- ============================================
-- END OF SEED DATA
-- ============================================

-- Note: Default password for all users is 'password123'
-- In production, these should be changed immediately after first login



