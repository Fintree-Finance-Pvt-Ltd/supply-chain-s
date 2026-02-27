import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierChequeAndBankDetails1772000000000 implements MigrationInterface {
  name = 'AddSupplierChequeAndBankDetails1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // suppliers: add partnerLoanId
    await queryRunner.query(`
      ALTER TABLE suppliers
      ADD COLUMN partnerLoanId varchar(50) NULL
    `);

    // supplier_documents
    await queryRunner.query(`
      CREATE TABLE supplier_documents (
        id int NOT NULL AUTO_INCREMENT,
        supplierId int NOT NULL,
        documentType varchar(50) NOT NULL,
        fileName varchar(255) NOT NULL,
        filePath varchar(500) NOT NULL,
        mimeType varchar(50) NULL,
        fileSize bigint NULL,
        uploadedBy int NOT NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX IDX_supplier_documents_supplierId (supplierId),
        CONSTRAINT FK_supplier_documents_supplier
          FOREIGN KEY (supplierId) REFERENCES suppliers(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    // supplier_bank_details
    await queryRunner.query(`
      CREATE TABLE supplier_bank_details (
        id int NOT NULL AUTO_INCREMENT,
        supplierId int NOT NULL,
        bankAccountNumber varchar(50) NOT NULL,
        ifscCode varchar(20) NOT NULL,
        bankName varchar(120) NOT NULL,
        accountHolderName varchar(120) NOT NULL,
        chequeDocumentId int NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX UQ_supplier_bank_details_supplierId (supplierId),
        CONSTRAINT FK_supplier_bank_details_supplier
          FOREIGN KEY (supplierId) REFERENCES suppliers(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS supplier_bank_details`);
    await queryRunner.query(`DROP TABLE IF EXISTS supplier_documents`);
    await queryRunner.query(`ALTER TABLE suppliers DROP COLUMN partnerLoanId`);
  }
}