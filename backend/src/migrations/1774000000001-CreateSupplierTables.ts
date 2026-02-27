import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSupplierTables1774000000001 implements MigrationInterface {
    name = 'CreateSupplierTables1774000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create supplier_bank_details table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS supplier_bank_details (
                id INT AUTO_INCREMENT PRIMARY KEY,
                supplierId INT NOT NULL UNIQUE,
                bankAccountNumber VARCHAR(50) NOT NULL,
                ifscCode VARCHAR(20) NOT NULL,
                bankName VARCHAR(120) NOT NULL,
                accountHolderName VARCHAR(120) NOT NULL,
                chequeDocumentId INT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_supplier_bank_details_supplierId (supplierId)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create supplier_documents table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS supplier_documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                supplierId INT NOT NULL,
                documentType VARCHAR(50) NOT NULL,
                fileName VARCHAR(255) NOT NULL,
                filePath VARCHAR(500) NOT NULL,
                mimeType VARCHAR(100) NULL,
                fileSize BIGINT NULL,
                uploadedBy INT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_supplier_documents_supplierId (supplierId)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS supplier_documents`);
        await queryRunner.query(`DROP TABLE IF EXISTS supplier_bank_details`);
    }
}
