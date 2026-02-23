import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierBankingColumns1771240000000 implements MigrationInterface {
    name = 'AddSupplierBankingColumns1771240000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add banking detail columns to suppliers table
        await queryRunner.query(`
      ALTER TABLE \`suppliers\`
        ADD COLUMN IF NOT EXISTS \`bankAccountNumber\` VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS \`ifscCode\` VARCHAR(50) NULL,
        ADD COLUMN IF NOT EXISTS \`bankName\` VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS \`accountHolderName\` VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS \`cancelledChequeUrl\` VARCHAR(500) NULL;
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE \`suppliers\`
        DROP COLUMN IF EXISTS \`bankAccountNumber\`,
        DROP COLUMN IF EXISTS \`ifscCode\`,
        DROP COLUMN IF EXISTS \`bankName\`,
        DROP COLUMN IF EXISTS \`accountHolderName\`,
        DROP COLUMN IF EXISTS \`cancelledChequeUrl\`;
    `);
    }
}
