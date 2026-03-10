import { MigrationInterface, QueryRunner, Table, TableColumn, TableUnique } from 'typeorm';

export class CreateLanSequencesTable1777000000001 implements MigrationInterface {
  name = 'CreateLanSequencesTable1777000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create lan_sequences table
    await queryRunner.createTable(
      new Table({
        name: 'lan_sequences',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'lender',
            type: 'enum',
            enum: ['KITE', 'FFPL', 'MFL'],
            isUnique: true,
          },
          {
            name: 'currentValue',
            type: 'int',
            default: 10000100,
          },
          {
            name: 'prefix',
            type: 'varchar',
            length: '10',
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

    // Seed initial sequences
    await queryRunner.query(`
      INSERT INTO lan_sequences (lender, currentValue, prefix) VALUES 
      ('FFPL', 10000100, 'FFPL'),
      ('MFL', 10000100, 'MFL'),
      ('KITE', 10000100, 'KITE')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('lan_sequences');
  }
}
