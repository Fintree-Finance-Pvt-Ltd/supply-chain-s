import { AppDataSource } from './src/config/database';
import { DataSource } from 'typeorm';

async function cleanup() {
    const dataSource = new DataSource({
        ...AppDataSource.options,
        synchronize: false,
        logging: true,
    });

    try {
        await dataSource.initialize();
        console.log('Connected to database for cleanup.');

        // Remove Foreign Key Checks to allow deletion
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
        console.log('Foreign key checks disabled.');

        // 1. Clean orphaned case_workflows -> customers
        console.log('Cleaning orphaned case_workflows...');
        const result1 = await dataSource.query(`
      DELETE FROM case_workflows 
      WHERE customerId IS NOT NULL 
      AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log(`Deleted ${result1.affectedRows} rows from case_workflows`);

        // 2. Clean orphaned case_status_history -> case_workflows
        console.log('Cleaning orphaned case_status_history (workflow)...');
        const result2 = await dataSource.query(`
      DELETE FROM case_status_history 
      WHERE caseWorkflowId IS NOT NULL 
      AND caseWorkflowId NOT IN (SELECT id FROM case_workflows)
    `);
        console.log(`Deleted ${result2.affectedRows} rows from case_status_history`);

        // 3. Clean orphaned case_status_history -> users (changedByUserId)
        console.log('Updating orphaned case_status_history (user)...');
        const result3 = await dataSource.query(`
      UPDATE case_status_history 
      SET changedByUserId = NULL 
      WHERE changedByUserId IS NOT NULL 
      AND changedByUserId NOT IN (SELECT id FROM users)
    `);
        console.log(`Updated ${result3.affectedRows} rows in case_status_history`);

        // 4. Clean orphaned credit_sanctions -> customers
        console.log('Cleaning orphaned credit_sanctions...');
        const result4 = await dataSource.query(`
      DELETE FROM credit_sanctions 
      WHERE customerId IS NOT NULL 
      AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log(`Deleted ${result4.affectedRows} rows from credit_sanctions`);

        // 5. Clean orphaned documents -> customers
        console.log('Cleaning orphaned documents...');
        const result5 = await dataSource.query(`
      DELETE FROM documents 
      WHERE customerId IS NOT NULL 
      AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log(`Deleted ${result5.affectedRows} rows from documents`);

        // Re-enable Foreign Key Checks
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Foreign key checks enabled.');

        console.log('Cleanup complete.');
        await dataSource.destroy();
        process.exit(0);

    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

cleanup();
