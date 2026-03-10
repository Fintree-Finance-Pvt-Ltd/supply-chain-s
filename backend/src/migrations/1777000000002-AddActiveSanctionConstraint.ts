import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class AddActiveSanctionConstraint1777000000002 implements MigrationInterface {
  name = 'AddActiveSanctionConstraint1777000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_active column to credit_sanctions table
    await queryRunner.addColumn(
      'credit_sanctions',
      new TableColumn({
        name: 'is_active',
        type: 'boolean',
        default: true,
      })
    );

    // Add unique constraint for active sanctions per customer
    // Only one active (is_active = true) sanction per customer
    await queryRunner.createIndex(
      'credit_sanctions',
      new TableIndex({
        name: 'idx_customer_active_sanction',
        columnNames: ['customerId', 'is_active'],
        where: 'is_active = true',
        isUnique: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('credit_sanctions', 'idx_customer_active_sanction');
    await queryRunner.dropColumn('credit_sanctions', 'is_active');
  }
}
