import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveLenderAndLanIdFromSanctionLimitHistory1776000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop columns from sanction_limit_history table
    await queryRunner.dropColumn('sanction_limit_history', 'lanId');
    await queryRunner.dropColumn('sanction_limit_history', 'lender');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add columns if rollback is needed
    await queryRunner.addColumn('sanction_limit_history', new TableColumn({
      name: 'lender',
      type: 'varchar',
      length: '50',
      isNullable: true,
    }));

    await queryRunner.addColumn('sanction_limit_history', new TableColumn({
      name: 'lanId',
      type: 'varchar',
      length: '50',
      isNullable: true,
    }));
  }
}
