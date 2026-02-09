import { AppDataSource } from './src/config/database';

async function cleanup() {
    try {
        console.log('Initializing data source...');
        // Initialize without sync first
        const dataSource = await AppDataSource.initialize();

        console.log('Cleaning up orphaned records...');

        // Clean case_workflows
        const workflows = await dataSource.query(`
      DELETE FROM case_workflows 
      WHERE customerId IS NOT NULL 
      AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log('Cleaned workflows:', workflows.affectedRows);

        // Clean case_status_history
        const history = await dataSource.query(`
      DELETE FROM case_status_history 
      WHERE caseWorkflowId IS NOT NULL 
      AND caseWorkflowId NOT IN (SELECT id FROM case_workflows)
    `);
        console.log('Cleaned history:', history.affectedRows);

        // Update case_status_history to valid changedByUserId
        // First, let's see if we have valid users, if not set to NULL
        const historyUsers = await dataSource.query(`
      UPDATE case_status_history 
      SET changedByUserId = NULL 
      WHERE changedByUserId IS NOT NULL 
      AND changedByUserId NOT IN (SELECT id FROM users)
    `);
        console.log('Cleaned history users:', historyUsers.affectedRows);

        // Clean credit_sanctions
        const sanctions = await dataSource.query(`
      DELETE FROM credit_sanctions 
      WHERE customerId IS NOT NULL 
      AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log('Cleaned sanctions:', sanctions.affectedRows);

        console.log('Cleanup complete.');
        await dataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
}

cleanup();
