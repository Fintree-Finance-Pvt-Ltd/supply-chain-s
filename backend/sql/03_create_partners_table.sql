-- ============================================================================
-- PARTNERS TABLE MIGRATION
-- ============================================================================
-- This script creates the partners table and migrates existing data
-- from hardcoded lender values (FFPL, MFL, KITE) to dynamic partner references
-- ============================================================================

-- STEP 1: Create Partners Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS partners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL UNIQUE,
    lanPrefix VARCHAR(10) NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- STEP 2: Insert Initial Partners
-- ============================================================================
INSERT INTO partners (name, code, lanPrefix, status) VALUES
('FinFlow Pvt Ltd', 'FFPL', 'FFPL', 'ACTIVE'),
('MFL Finance', 'MFL', 'MFL', 'ACTIVE'),
('Kite Lending', 'KITE', 'KITE', 'ACTIVE');

-- STEP 3: Add partnerId column to loan_accounts
-- ============================================================================
ALTER TABLE loan_accounts 
ADD COLUMN partnerId INT NULL;

-- STEP 4: Migrate loan_accounts lender to partnerId
-- ============================================================================
UPDATE loan_accounts la
INNER JOIN partners p ON la.lender = p.code
SET la.partnerId = p.id;

-- Make partnerId NOT NULL after migration (if data exists)
-- This will only work if there are loan accounts with data
-- ALTER TABLE loan_accounts MODIFY COLUMN partnerId INT NOT NULL;

-- STEP 5: Add partnerId column to lan_sequences
-- ============================================================================
ALTER TABLE lan_sequences 
ADD COLUMN partnerId INT NULL;

-- STEP 6: Migrate lan_sequences lender to partnerId
-- ============================================================================
UPDATE lan_sequences ls
INNER JOIN partners p ON ls.lender = p.code
SET ls.partnerId = p.id;

-- Make partnerId NOT NULL after migration
-- ALTER TABLE lan_sequences MODIFY COLUMN partnerId INT NOT NULL;

-- STEP 7: Add foreign keys
-- ============================================================================
ALTER TABLE loan_accounts 
ADD CONSTRAINT fk_loan_accounts_partner 
FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE RESTRICT;

ALTER TABLE lan_sequences 
ADD CONSTRAINT fk_lan_sequences_partner 
FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE RESTRICT;

-- STEP 8: Add partner_id to customers table (optional)
-- ============================================================================
-- Only run if lender column exists in customers table
-- ALTER TABLE customers ADD COLUMN partner_id INT NULL;
-- UPDATE customers c INNER JOIN partners p ON c.lender = p.code SET c.partner_id = p.id;
-- ALTER TABLE customers ADD CONSTRAINT fk_customers_partner FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- Run these commands in reverse order to rollback:

-- ALTER TABLE loan_accounts DROP FOREIGN KEY fk_loan_accounts_partner;
-- ALTER TABLE lan_sequences DROP FOREIGN KEY fk_lan_sequences_partner;
-- ALTER TABLE customers DROP FOREIGN KEY fk_customers_partner;

-- ALTER TABLE loan_accounts DROP COLUMN partnerId;
-- ALTER TABLE lan_sequences DROP COLUMN partnerId;
-- ALTER TABLE customers DROP COLUMN partner_id;

-- DROP TABLE IF EXISTS partners;
