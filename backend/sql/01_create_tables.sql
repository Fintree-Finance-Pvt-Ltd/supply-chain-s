-- ============================================
-- Supply Chain Finance System
-- Database Schema - CREATE TABLES
-- ============================================

-- Create database (if not exists)
CREATE DATABASE IF NOT EXISTS supply_chain_finance;
USE supply_chain_finance;

-- ============================================
-- 1. USERS & AUTHENTICATION
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20),
    isActive BOOLEAN DEFAULT TRUE,
    defaultRole VARCHAR(50),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_isActive (isActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 2. ROLES & PERMISSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_resource_action (resource, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_roles (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36) NOT NULL,
    roleId VARCHAR(36) NOT NULL,
    isActive BOOLEAN DEFAULT TRUE,
    assignedBy VARCHAR(36),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_role (userId, roleId),
    INDEX idx_userId (userId),
    INDEX idx_roleId (roleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_permissions (
    id VARCHAR(36) PRIMARY KEY,
    roleId VARCHAR(36) NOT NULL,
    permissionId VARCHAR(36) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_role_permission (roleId, permissionId),
    INDEX idx_roleId (roleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 3. CUSTOMERS
-- ============================================

CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    pan VARCHAR(10) UNIQUE NOT NULL,
    aadhaar VARCHAR(12),
    electricityBillNo VARCHAR(100),
    status ENUM(
        'draft',
        'submitted',
        'credit_approved',
        'post_sanction_pending',
        'post_sanction_completed',
        'operations_approved',
        'fully_onboarded',
        'rejected'
    ) DEFAULT 'draft',
    kycVerified BOOLEAN DEFAULT FALSE,
    rmId VARCHAR(36) NOT NULL,
    remarks TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rmId) REFERENCES users(id),
    INDEX idx_status (status),
    INDEX idx_rmId (rmId),
    INDEX idx_pan (pan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 4. DOCUMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(36) PRIMARY KEY,
    customerId VARCHAR(36) NOT NULL,
    documentType ENUM(
        'pan',
        'aadhaar',
        'electricity_bill',
        'sanction_letter',
        'esign_document',
        'enach_document',
        'other'
    ) NOT NULL,
    fileName VARCHAR(255) NOT NULL,
    filePath VARCHAR(500) NOT NULL,
    mimeType VARCHAR(50),
    fileSize BIGINT,
    uploadedBy VARCHAR(36) NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verifiedBy VARCHAR(36),
    verifiedAt TIMESTAMP NULL,
    remarks TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (uploadedBy) REFERENCES users(id),
    INDEX idx_customerId (customerId),
    INDEX idx_documentType (documentType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 5. CREDIT SANCTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS credit_sanctions (
    id VARCHAR(36) PRIMARY KEY,
    customerId VARCHAR(36) NOT NULL,
    sanctionAmount DECIMAL(15,2) NOT NULL,
    tenure INT NOT NULL,
    interestRate DECIMAL(5,2) NOT NULL,
    conditions TEXT,
    creditRemarks TEXT,
    creditOfficerId VARCHAR(36) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES customers(id),
    FOREIGN KEY (creditOfficerId) REFERENCES users(id),
    INDEX idx_customerId (customerId),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 6. POST SANCTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS post_sanctions (
    id VARCHAR(36) PRIMARY KEY,
    customerId VARCHAR(36) NOT NULL,
    esignStatus VARCHAR(50) DEFAULT 'pending',
    enachStatus VARCHAR(50) DEFAULT 'pending',
    remarks TEXT,
    isReadyForOps BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES customers(id),
    INDEX idx_customerId (customerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 7. OPERATIONS CHECKS
-- ============================================

CREATE TABLE IF NOT EXISTS operations_checks (
    id VARCHAR(36) PRIMARY KEY,
    customerId VARCHAR(36) NOT NULL,
    documentsVerified BOOLEAN DEFAULT FALSE,
    esignVerified BOOLEAN DEFAULT FALSE,
    enachVerified BOOLEAN DEFAULT FALSE,
    opsRemarks TEXT,
    opsUserId VARCHAR(36),
    status VARCHAR(50) DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES customers(id),
    FOREIGN KEY (opsUserId) REFERENCES users(id),
    INDEX idx_customerId (customerId),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 8. APPROVAL FLOW ENGINE
-- ============================================

CREATE TABLE IF NOT EXISTS approval_flows (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    flowType ENUM('credit_sanction', 'operations') NOT NULL,
    description TEXT,
    isActive BOOLEAN DEFAULT TRUE,
    isSequential BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_flowType (flowType),
    INDEX idx_isActive (isActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_steps (
    id VARCHAR(36) PRIMARY KEY,
    approvalFlowId VARCHAR(36) NOT NULL,
    approverRoleId VARCHAR(36),
    stepOrder INT NOT NULL,
    stepName VARCHAR(255),
    isRequired BOOLEAN DEFAULT TRUE,
    isParallel BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (approvalFlowId) REFERENCES approval_flows(id) ON DELETE CASCADE,
    FOREIGN KEY (approverRoleId) REFERENCES roles(id),
    INDEX idx_approvalFlowId (approvalFlowId),
    INDEX idx_stepOrder (stepOrder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_instances (
    id VARCHAR(36) PRIMARY KEY,
    approvalFlowId VARCHAR(36) NOT NULL,
    creditSanctionId VARCHAR(36),
    operationsCheckId VARCHAR(36),
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    currentStep INT DEFAULT 0,
    currentApproverId VARCHAR(36),
    remarks TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    FOREIGN KEY (approvalFlowId) REFERENCES approval_flows(id),
    FOREIGN KEY (creditSanctionId) REFERENCES credit_sanctions(id),
    FOREIGN KEY (operationsCheckId) REFERENCES operations_checks(id),
    FOREIGN KEY (currentApproverId) REFERENCES users(id),
    INDEX idx_status (status),
    INDEX idx_currentApproverId (currentApproverId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_actions (
    id VARCHAR(36) PRIMARY KEY,
    approvalInstanceId VARCHAR(36) NOT NULL,
    approverId VARCHAR(36) NOT NULL,
    action ENUM('approved', 'rejected') NOT NULL,
    stepOrder INT NOT NULL,
    comments TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approvalInstanceId) REFERENCES approval_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (approverId) REFERENCES users(id),
    INDEX idx_approvalInstanceId (approvalInstanceId),
    INDEX idx_approverId (approverId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 9. AUDIT & STATUS TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS case_status_history (
    id VARCHAR(36) PRIMARY KEY,
    customerId VARCHAR(36) NOT NULL,
    status ENUM(
        'draft',
        'submitted',
        'credit_approved',
        'post_sanction_pending',
        'post_sanction_completed',
        'operations_approved',
        'fully_onboarded',
        'rejected'
    ) NOT NULL,
    previousStatus ENUM(
        'draft',
        'submitted',
        'credit_approved',
        'post_sanction_pending',
        'post_sanction_completed',
        'operations_approved',
        'fully_onboarded',
        'rejected'
    ),
    changedBy VARCHAR(36) NOT NULL,
    remarks TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES customers(id),
    FOREIGN KEY (changedBy) REFERENCES users(id),
    INDEX idx_customerId (customerId),
    INDEX idx_status (status),
    INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- END OF SCHEMA
-- ============================================

