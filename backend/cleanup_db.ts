import { AppDataSource } from './src/config/database';

async function cleanup() {
    try {
        console.log('Disabling synchronization to perform cleanup...');
        AppDataSource.setOptions({ synchronize: false });

        console.log('Initializing data source...');
        await AppDataSource.initialize();

        console.log('Cleaning up orphaned case_workflows...');
        const result = await AppDataSource.query(
            'DELETE FROM `case_workflows` WHERE `customerId` IS NOT NULL AND `customerId` NOT IN (SELECT `id` FROM `customers`)'
        );
        console.log('Cleanup result:', result);

        console.log('Cleanup complete.');
        await AppDataSource.destroy();
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
}

cleanup();
