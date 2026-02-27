import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLenderColumnToCustomer1775000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('customers', new TableColumn({
      name: 'lender',
      type: 'varchar',
      length: '50',
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('customers', 'lender');
  }
}
