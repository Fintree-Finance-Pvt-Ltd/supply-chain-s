const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function cleanup() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'supplychainnew',
    };

    console.log('Connecting to database:', config.host, config.database);

    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected.');

        // Disable FK checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        console.log('Disabled FK checks.');

        // 1. Clean orphaned case_workflows -> customers
        const [res1] = await connection.query(`
      DELETE FROM case_workflows 
      WHERE customerId IS NOT NULL 
      AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log(`Deleted ${res1.affectedRows} orphaned case_workflows`);

        // 2. Clean orphaned case_status_history -> case_workflows
        const [res2] = await connection.query(`
      DELETE FROM case_status_history 
      WHERE caseWorkflowId IS NOT NULL 
      AND caseWorkflowId NOT IN (SELECT id FROM case_workflows)
    `);
        console.log(`Deleted ${res2.affectedRows} orphaned case_status_history (workflows)`);

        // 3. Update orphaned case_status_history -> users (using correct column 'changedBy')
        const [res3] = await connection.query(`
      UPDATE case_status_history 
      SET changedBy = NULL 
      WHERE changedBy IS NOT NULL 
      AND changedBy NOT IN (SELECT id FROM users)
    `);
        console.log(`Updated ${res3.affectedRows} orphaned case_status_history (users)`);

        // 4. Clean orphaned credit_sanctions -> customers
        const [res4] = await connection.query(`
      DELETE FROM credit_sanctions 
      WHERE customerId IS NOT NULL 
      AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log(`Deleted ${res4.affectedRows} orphaned credit_sanctions`);

        // 5. Clean orphaned documents -> customers
        const [res5] = await connection.query(`
      DELETE FROM documents 
      WHERE customerId IS NOT NULL 
      AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log(`Deleted ${res5.affectedRows} orphaned documents`);

        // Enable FK checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Enabled FK checks.');

        await connection.end();
        console.log('Cleanup complete.');
        process.exit(0);

    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

cleanup();
