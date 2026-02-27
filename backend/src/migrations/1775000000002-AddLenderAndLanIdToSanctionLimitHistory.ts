import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLenderAndLanIdToSanctionLimitHistory1775000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('sanction_limit_history', 'lanId');
    await queryRunner.dropColumn('sanction_limit_history', 'lender');
  }
}
