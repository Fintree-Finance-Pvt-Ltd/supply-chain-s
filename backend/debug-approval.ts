
import { AppDataSource } from './src/config/database';
import { ApprovalFlow, ApprovalStep, ApprovalInstance, User, UserRole, ApprovalAction } from './src/entities';
import { ROLES } from './src/config/constants';

async function debugApproval() {
    try {
        await AppDataSource.initialize();
        console.log('Database connected');

        // 1. Check Approval Flows
        const flows = await AppDataSource.getRepository(ApprovalFlow).find({
            relations: ['steps']
        });
        console.log('\n--- Approval Flows ---');
        console.log(JSON.stringify(flows, null, 2));

        // 2. Check Users and Roles
        const users = await AppDataSource.getRepository(User).find({
            relations: ['userRoles', 'userRoles.role']
        });
        console.log('\n--- Users and Roles ---');
        users.forEach(u => {
            console.log(`User: ${u.email} (ID: ${u.id})`);
            u.userRoles.forEach(r => console.log(`  - Role: ${r.role?.name} (ID: ${r.roleId})`));
        });

        // 3. Check Approval Instances
        const instances = await AppDataSource.getRepository(ApprovalInstance).find({
            relations: ['approvalFlow', 'creditSanction', 'actions']
        });
        console.log('\n--- Approval Instances ---');
        console.log(JSON.stringify(instances, null, 2));

        // 4. Check Credit Sanctions
        const sanctions = await AppDataSource.query('SELECT * FROM credit_sanctions');
        console.log('\n--- Credit Sanctions (Raw) ---');
        console.log(JSON.stringify(sanctions, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await AppDataSource.destroy();
    }
}

debugApproval();
