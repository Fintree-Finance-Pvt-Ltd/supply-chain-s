import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'supplychainnew',
    synchronize: false,
    logging: true,
    entities: ['src/entities/**/*.ts'],
});

async function cleanup() {
    try {
        await AppDataSource.initialize();
        console.log('Connected to database for cleanup.');

        // 1. Clean orphaned case_workflows -> customers
        console.log('Cleaning orphaned case_workflows...');
        const result1 = await AppDataSource.query(`
      DELETE FROM case_workflows 
      WHERE customerId IS NOT NULL 
      AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log(`Deleted ${result1.affectedRows} rows from case_workflows`);

        // 2. Clean orphaned case_status_history -> case_workflows
        console.log('Cleaning orphaned case_status_history (workflow)...');
        const result2 = await AppDataSource.query(`
      DELETE FROM case_status_history 
      WHERE caseWorkflowId IS NOT NULL 
      AND caseWorkflowId NOT IN (SELECT id FROM case_workflows)
    `);
        console.log(`Deleted ${result2.affectedRows} rows from case_status_history`);

        // 3. Clean orphaned case_status_history -> users (changedByUserId)
        console.log('Updating orphaned case_status_history (user)...');
        const result3 = await AppDataSource.query(`
      UPDATE case_status_history 
      SET changedByUserId = NULL 
      WHERE changedByUserId IS NOT NULL 
      AND changedByUserId NOT IN (SELECT id FROM users)
    `);
        console.log(`Updated ${result3.affectedRows} rows in case_status_history`);

        // 4. Clean orphaned credit_sanctions -> customers
        console.log('Cleaning orphaned credit_sanctions...');
        const result4 = await AppDataSource.query(`
      DELETE FROM credit_sanctions 
      WHERE customerId IS NOT NULL 
      AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log(`Deleted ${result4.affectedRows} rows from credit_sanctions`);

        // 5. Clean orphaned documents -> customers
        console.log('Cleaning orphaned documents...');
        const result5 = await AppDataSource.query(`
      DELETE FROM documents 
      WHERE customerId IS NOT NULL 
      AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log(`Deleted ${result5.affectedRows} rows from documents`);

        console.log('Cleanup complete.');
        await AppDataSource.destroy();

    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

cleanup();
