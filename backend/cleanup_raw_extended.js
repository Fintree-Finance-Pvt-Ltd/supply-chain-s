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

        // 1. Clean orphaned approval_instances -> credit_sanctions (likely culprit)
        const [res1] = await connection.query(`
      DELETE FROM approval_instances 
      WHERE creditSanctionId IS NOT NULL 
      AND creditSanctionId NOT IN (SELECT id FROM credit_sanctions)
    `);
        console.log(`Deleted ${res1.affectedRows} orphaned approval_instances (sanctions)`);

        // 2. Clean orphaned approval_actions -> approval_instances
        const [res2] = await connection.query(`
      DELETE FROM approval_actions 
      WHERE approvalInstanceId IS NOT NULL 
      AND approvalInstanceId NOT IN (SELECT id FROM approval_instances)
    `);
        console.log(`Deleted ${res2.affectedRows} orphaned approval_actions (instances)`);

        // 3. Clean orphaned approval_actions -> users
        const [res3] = await connection.query(`
      DELETE FROM approval_actions 
      WHERE approverId IS NOT NULL 
      AND approverId NOT IN (SELECT id FROM users)
    `);
        console.log(`Deleted ${res3.affectedRows} orphaned approval_actions (users)`);

        // 4. Repeat previous critical cleans just in case
        const [res4] = await connection.query(`
      DELETE FROM credit_sanctions 
      WHERE customerId IS NOT NULL 
      AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log(`Deleted ${res4.affectedRows} orphaned credit_sanctions`);

        const [res5] = await connection.query(`
       DELETE FROM case_workflows 
       WHERE customerId IS NOT NULL 
       AND customerId NOT IN (SELECT id FROM customers)
    `);
        console.log(`Deleted ${res5.affectedRows} orphaned case_workflows`);


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
