import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migration: Create Partners Table and Migrate Data
 * 
 * This migration:
 * 1. Creates the partners table
 * 2. Inserts initial partners (FFPL, MFL, KITE)
 * 3. Updates loan_accounts to add partner_id column
 * 4. Updates lan_sequences to add partner_id column
 * 5. Migrates existing lender data to partner references
 */
export class CreatePartnersTable1778000000001 implements MigrationInterface {
  name = 'CreatePartnersTable1778000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('[Migration] Starting: CreatePartnersTable');

    // ==========================================
    // STEP 1: Create Partners Table
    // ==========================================
    await queryRunner.createTable(
      new Table({
        name: 'partners',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'code',
            type: 'varchar',
            length: '10',
            isUnique: true,
          },
          {
            name: 'lanPrefix',
            type: 'varchar',
            length: '10',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ACTIVE', 'INACTIVE'],
            default: "'ACTIVE'",
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );
    console.log('[Migration] Created partners table');

    // ==========================================
    // STEP 2: Insert Initial Partners
    // ==========================================
    await queryRunner.query(`
      INSERT INTO partners (name, code, lanPrefix, status) VALUES
      ('FinFlow Pvt Ltd', 'FFPL', 'FFPL', 'ACTIVE'),
      ('MFL Finance', 'MFL', 'MFL', 'ACTIVE'),
      ('Kite Lending', 'KITE', 'KITE', 'ACTIVE')
    `);
    console.log('[Migration] Inserted initial partners');

    // ==========================================
    // STEP 3: Add partnerId to loan_accounts
    // ==========================================
    await queryRunner.query(`
      ALTER TABLE loan_accounts 
      ADD COLUMN partnerId INT NULL
    `);
    console.log('[Migration] Added partnerId column to loan_accounts');

    // ==========================================
    // STEP 4: Migrate loan_accounts lender to partnerId
    // ==========================================
    await queryRunner.query(`
      UPDATE loan_accounts la
      INNER JOIN partners p ON la.lender = p.code
      SET la.partnerId = p.id
    `);
    console.log('[Migration] Migrated loan_accounts lender to partnerId');

    // Make partnerId NOT NULL after migration (if data exists)
    const loanAccountsWithPartner = await queryRunner.query(`
      SELECT COUNT(*) as count FROM loan_accounts WHERE partnerId IS NOT NULL
    `);
    
    if (loanAccountsWithPartner[0].count > 0) {
      await queryRunner.query(`
        ALTER TABLE loan_accounts 
        MODIFY COLUMN partnerId INT NOT NULL
      `);
      console.log('[Migration] Made partnerId NOT NULL in loan_accounts');
    }

    // ==========================================
    // STEP 5: Add partnerId to lan_sequences
    // ==========================================
    await queryRunner.query(`
      ALTER TABLE lan_sequences 
      ADD COLUMN partnerId INT NULL
    `);
    console.log('[Migration] Added partnerId column to lan_sequences');

    // ==========================================
    // STEP 6: Migrate lan_sequences lender to partnerId
    // ==========================================
    await queryRunner.query(`
      UPDATE lan_sequences ls
      INNER JOIN partners p ON ls.lender = p.code
      SET ls.partnerId = p.id
    `);
    console.log('[Migration] Migrated lan_sequences lender to partnerId');

    // Make partnerId NOT NULL after migration
    const sequencesWithPartner = await queryRunner.query(`
      SELECT COUNT(*) as count FROM lan_sequences WHERE partnerId IS NOT NULL
    `);
    
    if (sequencesWithPartner[0].count > 0) {
      await queryRunner.query(`
        ALTER TABLE lan_sequences 
        MODIFY COLUMN partnerId INT NOT NULL
      `);
      console.log('[Migration] Made partnerId NOT NULL in lan_sequences');
    }

    // ==========================================
    // STEP 7: Add foreign keys
    // ==========================================
    await queryRunner.createForeignKey(
      'loan_accounts',
      new TableForeignKey({
        columnNames: ['partnerId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'partners',
        onDelete: 'RESTRICT',
      })
    );
    console.log('[Migration] Added foreign key for loan_accounts.partnerId');

    await queryRunner.createForeignKey(
      'lan_sequences',
      new TableForeignKey({
        columnNames: ['partnerId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'partners',
        onDelete: 'RESTRICT',
      })
    );
    console.log('[Migration] Added foreign key for lan_sequences.partnerId');

    // ==========================================
    // STEP 8: Add partner_id to customers table (optional - for quick reference)
    // ==========================================
    // Check if lender column exists in customers
    const customerTable = await queryRunner.getTable('customers');
    const lenderColumn = customerTable?.columns.find(c => c.name === 'lender');
    
    if (lenderColumn) {
      await queryRunner.query(`
        ALTER TABLE customers 
        ADD COLUMN partner_id INT NULL
      `);
      
      await queryRunner.query(`
        UPDATE customers c
        INNER JOIN partners p ON c.lender = p.code
        SET c.partner_id = p.id
      `);
      
      await queryRunner.createForeignKey(
        'customers',
        new TableForeignKey({
          columnNames: ['partner_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'partners',
          onDelete: 'SET NULL',
        })
      );
      console.log('[Migration] Added partner_id to customers table');
    }

    console.log('[Migration] Completed: CreatePartnersTable');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('[Migration] Rolling back: CreatePartnersTable');

    // Drop foreign keys first
    const loanAccountsTable = await queryRunner.getTable('loan_accounts');
    const lanSequencesTable = await queryRunner.getTable('lan_sequences');
    const customersTable = await queryRunner.getTable('customers');

    // Drop foreign keys
    const loanAccountsFk = loanAccountsTable?.foreignKeys.find(fk => fk.columnNames.includes('partnerId'));
    if (loanAccountsFk) {
      await queryRunner.dropForeignKey('loan_accounts', loanAccountsFk);
    }

    const lanSequencesFk = lanSequencesTable?.foreignKeys.find(fk => fk.columnNames.includes('partnerId'));
    if (lanSequencesFk) {
      await queryRunner.dropForeignKey('lan_sequences', lanSequencesFk);
    }

    const customersFk = customersTable?.foreignKeys.find(fk => fk.columnNames.includes('partner_id'));
    if (customersFk) {
      await queryRunner.dropForeignKey('customers', customersFk);
    }

    // Drop columns
    await queryRunner.query(`ALTER TABLE loan_accounts DROP COLUMN partnerId`);
    await queryRunner.query(`ALTER TABLE lan_sequences DROP COLUMN partnerId`);
    await queryRunner.query(`ALTER TABLE customers DROP COLUMN partner_id`);

    // Drop table
    await queryRunner.dropTable('partners');

    console.log('[Migration] Rollback complete');
  }
}
